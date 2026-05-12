import { Component, Input, AfterViewInit, ElementRef, ViewChild, OnChanges, OnDestroy, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';

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
  @Input() mapId: string = 'route-map';
  @Input() height: string = '220px';
  @Input() routeGeoJson: any = null;
  /** Terminal-configured bus stops (approved route package) */
  @Input() routeStops: RouteMapStop[] = [];
  /** Ticket holders for this schedule (boarding list) */
  @Input() boardingPassengers: RouteMapBoardingPassenger[] = [];
  /** Live driver position [lng, lat] from device GPS (or mock location app). */
  @Input() driverLngLat: [number, number] | null = null;

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  mapLoaded = false;
  private pathMarkers: any[] = [];
  private stopMarkers: any[] = [];
  /** key = "lng,lat" stop position → marker for that waiting group */
  private boardingStopMarkers = new Map<string, { marker: any; lng: number; lat: number }>();
  /** Bus / driver position from GPS updates */
  private liveBusMarker: any = null;
  private resizeObserver: ResizeObserver | null = null;

  ngAfterViewInit() {
    const token = environment.mapbox.accessToken.trim();
    if (token) {
      mapboxgl.accessToken = token;
    }

    const el = this.mapContainer.nativeElement;
    this.map = new mapboxgl.Map({
      container: el,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [123.920994, 10.311008],
      zoom: 12,
      attributionControl: true,
    });

    this.resizeObserver = new ResizeObserver(() => {
      try {
        this.map?.resize();
      } catch {
        /* ignore */
      }
    });
    this.resizeObserver.observe(el);

    this.map.on('load', () => {
      this.mapLoaded = true;
      this.drawRoute();
      this.syncLiveBusMarker();
      queueMicrotask(() => {
        try {
          this.map?.resize();
        } catch {
          /* ignore */
        }
      });
      setTimeout(() => {
        try {
          this.map?.resize();
        } catch {
          /* ignore */
        }
      }, 200);
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      this.mapLoaded &&
      (changes['routeGeoJson'] || changes['routeStops'] || changes['boardingPassengers'])
    ) {
      this.drawRoute();
      if (changes['routeGeoJson'] || changes['height']) {
        setTimeout(() => {
          try {
            this.map?.resize();
          } catch {
            /* ignore */
          }
        }, 150);
      }
    }
    if (this.mapLoaded && changes['driverLngLat']) {
      this.syncLiveBusMarker();
    }
  }

  ngOnDestroy() {
    this.clearLiveBusMarker();
    this.resizeObserver?.disconnect();
    this.resizeObserver = null;
    try {
      this.map?.remove();
    } catch {
      /* ignore */
    }
    this.map = null;
    this.mapLoaded = false;
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
    this.syncLiveBusMarker();

    if (!hasLine && this.routeStops?.length) {
      this.fitToStopsOnly();
    }
  }

  private syncLiveBusMarker() {
    if (!this.mapLoaded || !this.map) {
      return;
    }
    const pos = this.driverLngLat;
    if (!pos || pos.length !== 2 || Number.isNaN(pos[0]) || Number.isNaN(pos[1])) {
      this.clearLiveBusMarker();
      return;
    }
    const lng = pos[0];
    const lat = pos[1];
    if (!this.liveBusMarker) {
      this.liveBusMarker = new mapboxgl.Marker({ color: '#0074D9', scale: 1.2 })
        .setLngLat([lng, lat])
        .addTo(this.map);
    } else {
      this.liveBusMarker.setLngLat([lng, lat]);
    }
    this.checkBusPastBoardingStops(lng, lat);
  }

  private clearLiveBusMarker() {
    if (this.liveBusMarker) {
      try {
        this.liveBusMarker.remove();
      } catch {
        /* ignore */
      }
      this.liveBusMarker = null;
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
    (this.routeStops || []).forEach((stop, i) => {
      const ll = this.stopLngLat(stop);
      if (!ll) {
        return;
      }
      const title = stop.name?.trim() || `Bus stop ${i + 1}`;
      const dist =
        stop.distance_km_from_start != null
          ? `<br><span style="color:#666">${Number(stop.distance_km_from_start).toFixed(2)} km from start</span>`
          : '';
      const el = new mapboxgl.Marker({ color: '#f97316', scale: 1 })
        .setLngLat(ll)
        .setPopup(
          new mapboxgl.Popup({ maxWidth: '280px' }).setHTML(
            `<div style="padding:8px;"><strong>${this.escapeHtml(title)}</strong>${dist}</div>`
          )
        )
        .addTo(this.map);
      this.stopMarkers.push(el);
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
  }

  private clearBoardingMarkers() {
    this.boardingStopMarkers.forEach(({ marker }) => { try { marker.remove(); } catch {} });
    this.boardingStopMarkers.clear();
  }

  /** Removes waiting-at-stop markers when the bus is near that stop (~200 m). */
  private checkBusPastBoardingStops(busLng: number, busLat: number) {
    const toRemove: string[] = [];
    this.boardingStopMarkers.forEach(({ marker, lng, lat }, key) => {
      const dx = busLng - lng;
      const dy = busLat - lat;
      if (Math.sqrt(dx * dx + dy * dy) < 0.002) { // ~200 m
        try { marker.remove(); } catch {}
        toRemove.push(key);
      }
    });
    toRemove.forEach(k => this.boardingStopMarkers.delete(k));
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

  private escapeHtml(s: string): string {
    return s
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }
}
