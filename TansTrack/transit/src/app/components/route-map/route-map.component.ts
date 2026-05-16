import { Component, Input, Output, EventEmitter, AfterViewInit, ElementRef, ViewChild, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Subscription } from 'rxjs';
import { BusSimulatorService } from '../../services/bus-simulator.service';

declare var mapboxgl: any;

/** Terminal-approved stop (lng/lat), aligned with commuter API */
export interface RouteMapStop {
  name?: string;
  lng?: number;
  lat?: number;
  longitude?: number;
  latitude?: number;
  order?: number;
  distance_km_from_start?: number;
}

export interface RouteMapBoardingPassenger {
  public_ticket_id?: string;
  fare?: number;
  commuter_name?: string;
  commuter_email?: string;
  alighted?: boolean;
  boarding_lng?: number | null;
  boarding_lat?: number | null;
  boarding_stop_name?: string | null;
  drop_off_lng?: number | null;
  drop_off_lat?: number | null;
  drop_off_stop_name?: string | null;
  payment_status?: string | null;
  /** True only for boarding requests — commuter waiting at a stop, not yet aboard */
  is_boarding_request?: boolean;
}

@Component({
  selector: 'app-route-map',
  templateUrl: './route-map.component.html',
  styleUrls: ['./route-map.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class RouteMapComponent implements AfterViewInit, OnChanges, OnDestroy {
  constructor(private busSimulator: BusSimulatorService) {}
  @Input() mapId: string = 'route-map';
  @Input() height: string = '220px';
  @Input() routeGeoJson: any = null;
  /** Terminal-configured bus stops (approved route package) */
  @Input() routeStops: RouteMapStop[] = [];
  /** Ticket holders for this schedule (boarding list) */
  @Input() boardingPassengers: RouteMapBoardingPassenger[] = [];
  /** When true, animates a bus marker along the route coordinates */
  @Input() simulate: boolean = false;
  /** Optional key to scope simulation progress per schedule/leg */
  @Input() simKey: string | number | null = null;
  /** Emits each position the simulation marker moves to */
  @Output() positionUpdate = new EventEmitter<{ lng: number; lat: number }>();
  /** Emits once when the simulated bus reaches the final route coordinate */
  @Output() arrivedAtDestination = new EventEmitter<void>();
  /** Emits when the bus passes a commuter's chosen drop-off stop */
  @Output() passengerDropOff = new EventEmitter<{ ticketId: string; commuterName: string; stopName: string }>();

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  mapLoaded = false;
  private pathMarkers: any[] = [];
  private stopMarkers: any[] = [];
  /** key = "lng,lat" stop position → marker for that waiting group */
  private boardingStopMarkers = new Map<string, { marker: any; lng: number; lat: number }>();
  private busMarker: any = null;
  private simulationSub: Subscription | null = null;
  private currentBusLng = 0;
  private currentBusLat = 0;
  /** Ticket IDs already emitted for drop-off — prevents repeated toasts on same stop */
  private dropOffEmitted = new Set<string>();

  ngAfterViewInit() {
    mapboxgl.accessToken = 'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA';
    // Note: mapbox-gl v3 exposes EVENTS_URL as read-only; do not assign it (throws TypeError).

    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v11',
      center: [123.920994, 10.311008],
      zoom: 12
    });

    this.map.on('load', () => {
      this.mapLoaded = true;
      this.drawRoute();
      if (this.simulate) {
        this.startSimulation();
      }
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      this.mapLoaded &&
      (changes['routeGeoJson'] || changes['routeStops'] || changes['boardingPassengers'])
    ) {
      this.drawRoute();

      // Only restart simulation when route geometry changes, NOT when boarding passengers update
      if (this.simulate && (changes['routeGeoJson'] || changes['routeStops'])) {
        // Clear saved simulation step when geometry changes to prevent teleporting on reversed routes.
        try {
          sessionStorage.removeItem(this.getSimStepKey());
        } catch {}
        this.startSimulation();
      }
    }
    if (changes['simulate'] && this.mapLoaded) {
      if (this.simulate) {
        try {
          sessionStorage.removeItem(this.getSimStepKey());
        } catch {}
        this.startSimulation();
      } else {
        this.stopSimulation();
      }
    }
  }


  ngOnDestroy() {
    this.stopSimulation();
  }

  drawRoute() {

    if (!this.mapLoaded || !this.map) {
      return;
    }

    if (this.map.getLayer('route-line')) {
      this.map.removeLayer('route-line');
    }
    if (this.map.getSource('route')) {
      this.map.removeSource('route');
    }

    this.clearMarkerList(this.pathMarkers);
    this.clearMarkerList(this.stopMarkers);
    this.clearBoardingMarkers();
    this.pathMarkers = [];
    this.stopMarkers = [];

    const hasLine =
      this.routeGeoJson &&
      this.routeGeoJson.type === 'LineString' &&
      Array.isArray(this.routeGeoJson.coordinates) &&
      this.routeGeoJson.coordinates.length >= 2;

    if (hasLine) {
      this.map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: this.routeGeoJson
        }
      });

      this.map.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0074D9',
          'line-width': 6
        }
      });

      const bounds = new mapboxgl.LngLatBounds();
      this.routeGeoJson.coordinates.forEach((coord: [number, number]) => {
        if (coord?.length === 2) {
          bounds.extend(coord);
        }
      });
      this.map.fitBounds(bounds, { padding: 40, maxZoom: 14 });

      this.addPathEndpoints();
    }

    this.addStopMarkers();
    this.addBoardingMarkers();

    if (!hasLine && this.routeStops?.length) {
      this.fitToStopsOnly();
    }
  }

  private readonly SIM_STEP_KEY = 'driver_sim_step';

  private getSimStepKey(): string {
    const suffix = this.simKey != null ? String(this.simKey) : 'default';
    return `${this.SIM_STEP_KEY}_${suffix}`;
  }

  private startSimulation() {
    this.stopSimulation();
    this.dropOffEmitted.clear();
    if (!this.mapLoaded || !this.map) return;
    const coords: number[][] = this.routeGeoJson?.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) return;

    const saved = sessionStorage.getItem(this.getSimStepKey());
    const savedStep = saved !== null ? parseInt(saved, 10) : -1;
    const lastIdx = coords.length - 1;
    const startIdx = savedStep >= 0 && savedStep < coords.length ? savedStep : 0;

    // Simulation already reached the end in a previous session — re-emit arrived so the
    // trip completes even if the component was remounted (tab switch, app restart, etc.).
    if (savedStep >= lastIdx) {
      this.busMarker = new mapboxgl.Marker({ element: this.createBusMarkerEl(), anchor: 'center' })
        .setLngLat([coords[lastIdx][0], coords[lastIdx][1]])
        .addTo(this.map);
      this.currentBusLng = coords[lastIdx][0];
      this.currentBusLat = coords[lastIdx][1];
      this.positionUpdate.emit({ lng: this.currentBusLng, lat: this.currentBusLat });
      this.arrivedAtDestination.emit();
      return;
    }

    this.busMarker = new mapboxgl.Marker({ element: this.createBusMarkerEl(), anchor: 'center' })
      .setLngLat([coords[startIdx][0], coords[startIdx][1]])
      .addTo(this.map);

    const stopsForSim = (this.routeStops || [])
      .map(s => {
        const lng = s.lng ?? s.longitude;
        const lat = s.lat ?? s.latitude;
        return (lng != null && lat != null) ? { lng: Number(lng), lat: Number(lat) } : null;
      })
      .filter((s): s is { lng: number; lat: number } => s !== null);

    this.simulationSub = this.busSimulator.simulateAlongLine(coords, 400, startIdx, stopsForSim).subscribe({
      next: ({ lng, lat, index }) => {
        this.currentBusLng = lng;
        this.currentBusLat = lat;
        this.busMarker.setLngLat([lng, lat]);
        this.positionUpdate.emit({ lng, lat });
        sessionStorage.setItem(this.getSimStepKey(), String(index));
        this.checkBusPastBoardingStops(lng, lat);
        this.checkBusPastDropOffStops(lng, lat);
      },
      complete: () => {
        this.arrivedAtDestination.emit();
        const last = coords.length - 1;
        sessionStorage.setItem(this.getSimStepKey(), String(last));
        this.simulationSub = null;
      },
    });
  }

  private stopSimulation() {
    this.simulationSub?.unsubscribe();
    this.simulationSub = null;
    if (this.busMarker) {
      this.busMarker.remove();
      this.busMarker = null;
    }
  }

  private clearMarkerList(list: any[]) {
    list.forEach((m) => m.remove());
  }

  private addPathEndpoints() {
    if (!this.routeGeoJson?.coordinates?.length) {
      return;
    }
    const coordinates = this.routeGeoJson.coordinates;
    const startCoord = coordinates[0];
    const startMarker = new mapboxgl.Marker({ color: '#22c55e', scale: 1.2 })
      .setLngLat(startCoord)
      .setPopup(
        new mapboxgl.Popup().setHTML(
          '<div style="padding:8px;"><strong>Start</strong><br>Route begins here</div>'
        )
      )
      .addTo(this.map);
    this.pathMarkers.push(startMarker);

    if (coordinates.length > 1) {
      const endCoord = coordinates[coordinates.length - 1];
      const endMarker = new mapboxgl.Marker({ color: '#ef4444', scale: 1.2 })
        .setLngLat(endCoord)
        .setPopup(
          new mapboxgl.Popup().setHTML(
            '<div style="padding:8px;"><strong>End</strong><br>Route ends here</div>'
          )
        )
        .addTo(this.map);
      this.pathMarkers.push(endMarker);
    }
  }

  private stopLngLat(stop: RouteMapStop): [number, number] | null {
    const lng = stop.lng ?? stop.longitude;
    const lat = stop.lat ?? stop.latitude;
    if (typeof lng === 'number' && typeof lat === 'number' && !isNaN(lng) && !isNaN(lat)) {
      return [lng, lat];
    }
    return null;
  }

  private addStopMarkers() {
    const stops = this.routeStops || [];
    const total = stops.length;
    stops.forEach((stop, i) => {
      // First stop = terminal (already has green start marker), last = endpoint (red end marker) — skip both.
      if (i === 0 || i === total - 1) return;
      const ll = this.stopLngLat(stop);
      if (!ll) return;
      const title = stop.name?.trim() || `Bus stop ${i}`;
      const dist =
        stop.distance_km_from_start != null
          ? `<br><span style="color:#666">${Number(stop.distance_km_from_start).toFixed(2)} km from start</span>`
          : '';
      const pinEl = document.createElement('div');
      pinEl.style.cssText = [
        'width:28px', 'height:28px', 'border-radius:50%',
        'background:#f97316', 'border:2.5px solid #fff',
        'box-shadow:0 2px 6px rgba(0,0,0,0.35)',
        'display:flex', 'align-items:center', 'justify-content:center',
        'color:#fff', 'font-weight:700', 'font-size:11px', 'font-family:sans-serif',
        'cursor:pointer'
      ].join(';');
      pinEl.textContent = String(i);
      const marker = new mapboxgl.Marker({ element: pinEl, anchor: 'center' })
        .setLngLat(ll)
        .setPopup(
          new mapboxgl.Popup({ maxWidth: '280px' }).setHTML(
            `<div style="padding:8px;"><strong>${this.escapeHtml(title)}</strong>${dist}</div>`
          )
        )
        .addTo(this.map);
      this.stopMarkers.push(marker);
    });
  }

  private addBoardingMarkers() {
    this.clearBoardingMarkers();

    // Only show passengers who are actively waiting at a stop (not yet aboard)
    const waiting = (this.boardingPassengers || []).filter(p => p.is_boarding_request && !p.alighted);
    if (!waiting.length) return;

    // Fallback anchor: route start or first stop
    let fallbackAnchor: [number, number] | null =
      this.routeGeoJson?.coordinates?.[0] ?? null;
    if (!fallbackAnchor && this.routeStops?.length) {
      for (const s of this.routeStops) {
        const ll = this.stopLngLat(s);
        if (ll) { fallbackAnchor = ll; break; }
      }
    }

    // Group passengers by boarding stop position
    const groups = new Map<string, { passengers: RouteMapBoardingPassenger[]; lng: number; lat: number; name: string }>();
    for (const p of waiting) {
      let lng: number, lat: number, stopName: string;
      if (p.boarding_lng != null && p.boarding_lat != null) {
        lng = p.boarding_lng;
        lat = p.boarding_lat;
        stopName = p.boarding_stop_name || 'Bus Stop';
      } else if (fallbackAnchor) {
        [lng, lat] = fallbackAnchor;
        stopName = 'Terminal';
      } else {
        continue;
      }
      const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
      if (!groups.has(key)) groups.set(key, { passengers: [], lng, lat, name: stopName });
      groups.get(key)!.passengers.push(p);
    }

    groups.forEach(({ passengers: grp, lng, lat, name }) => {
      const names = grp.map(p => p.commuter_name || p.public_ticket_id || 'Passenger');
      const lines = names.slice(0, 10).map(n => this.escapeHtml(String(n))).join('<br>');
      const more = names.length > 10 ? `<br><em>+${names.length - 10} more</em>` : '';
      const html = `<div style="padding:8px;"><strong>Waiting at ${this.escapeHtml(name)} (${grp.length})</strong><br>${lines}${more}</div>`;
      const marker = new mapboxgl.Marker({ color: '#a855f7', scale: 1.05 })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup({ maxWidth: '280px' }).setHTML(html))
        .addTo(this.map);
      const key = `${lng.toFixed(5)},${lat.toFixed(5)}`;
      this.boardingStopMarkers.set(key, { marker, lng, lat });
    });

    // Immediately remove any markers the bus has already passed
    if (this.currentBusLng !== 0 || this.currentBusLat !== 0) {
      this.checkBusPastBoardingStops(this.currentBusLng, this.currentBusLat);
    }
  }

  private clearBoardingMarkers() {
    this.boardingStopMarkers.forEach(({ marker }) => { try { marker.remove(); } catch {} });
    this.boardingStopMarkers.clear();
  }

  /** Called on each simulation step — removes markers for stops the bus has passed (~200 m). */
  private checkBusPastBoardingStops(busLng: number, busLat: number) {
    const toRemove: string[] = [];
    this.boardingStopMarkers.forEach(({ marker, lng, lat }, key) => {
      const dx = busLng - lng;
      const dy = busLat - lat;
      if (Math.sqrt(dx * dx + dy * dy) < 0.004) { // ~400 m
        try { marker.remove(); } catch {}
        toRemove.push(key);
      }
    });
    toRemove.forEach(k => this.boardingStopMarkers.delete(k));
  }

  /** Called on each simulation step — emits drop-off event for passengers whose stop the bus has reached (~400 m). */
  private checkBusPastDropOffStops(busLng: number, busLat: number) {
    const aboard = (this.boardingPassengers || []).filter(
      p => !p.is_boarding_request && !p.alighted && p.drop_off_lng != null && p.drop_off_lat != null
    );
    for (const p of aboard) {
      const ticketId = p.public_ticket_id;
      if (!ticketId || this.dropOffEmitted.has(ticketId)) continue;
      const dx = busLng - p.drop_off_lng!;
      const dy = busLat - p.drop_off_lat!;
      if (Math.sqrt(dx * dx + dy * dy) < 0.004) { // ~400 m
        this.dropOffEmitted.add(ticketId);
        this.passengerDropOff.emit({
          ticketId,
          commuterName: p.commuter_name || 'Passenger',
          stopName: p.drop_off_stop_name || 'stop',
        });
      }
    }
  }

  private fitToStopsOnly() {
    const bounds = new mapboxgl.LngLatBounds();
    let n = 0;
    for (const stop of this.routeStops || []) {
      const ll = this.stopLngLat(stop);
      if (ll) {
        bounds.extend(ll);
        n++;
      }
    }
    if (n > 0) {
      this.map.fitBounds(bounds, { padding: 50, maxZoom: 14 });
    }
  }

  private createBusMarkerEl(): HTMLElement {
    const el = document.createElement('div');
    el.style.cssText = 'font-size:28px;line-height:1;filter:drop-shadow(0 2px 4px rgba(0,0,0,0.45));cursor:default;';
    el.textContent = '🚌';
    return el;
  }

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
