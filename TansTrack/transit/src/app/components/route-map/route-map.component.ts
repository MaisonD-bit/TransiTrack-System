import { Component, Input, Output, EventEmitter, AfterViewInit, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';

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
}

@Component({
  selector: 'app-route-map',
  templateUrl: './route-map.component.html',
  styleUrls: ['./route-map.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule]
})
export class RouteMapComponent implements AfterViewInit, OnChanges {
  @Input() mapId: string = 'route-map';
  @Input() height: string = '220px';
  @Input() routeGeoJson: any = null;
  /** Terminal-configured bus stops (approved route package) */
  @Input() routeStops: RouteMapStop[] = [];
  /** Ticket holders for this schedule (boarding list) */
  @Input() boardingPassengers: RouteMapBoardingPassenger[] = [];
  /** Live driver/bus position [lng, lat] */
  @Input() driverLngLat: [number, number] | null = null;
  /** Emits when driver is detected off-route (best-effort). */
  @Output() offRouteChanged = new EventEmitter<boolean>();

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  mapLoaded = false;
  private pathMarkers: any[] = [];
  private stopMarkers: any[] = [];
  private boardingMarkers: any[] = [];
  private driverMarker?: any;
  private offRoute = false;
  private geolocateControl?: any;

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
      this.ensureGeolocateControl();
    });
  }

  private ensureGeolocateControl() {
    if (!this.mapLoaded || !this.map || this.geolocateControl) return;
    try {
      this.geolocateControl = new mapboxgl.GeolocateControl({
        positionOptions: {
          enableHighAccuracy: true,
          maximumAge: 0,
          timeout: 20000,
        },
        trackUserLocation: true,
        showUserLocation: true,
        showUserHeading: true,
      });
      this.map.addControl(this.geolocateControl, 'top-left');

      if (this.geolocateControl?.trigger) {
        this.geolocateControl.trigger();
      }
    } catch {
      // ignore
    }
  }

  zoomIn() {
    if (this.mapLoaded && this.map) {
      this.map.zoomIn();
    }
  }

  zoomOut() {
    if (this.mapLoaded && this.map) {
      this.map.zoomOut();
    }
  }

  /**
   * Best-effort fit to current data (route line preferred, then stops).
   */
  fitToRouteOrStops() {
    if (!this.mapLoaded || !this.map) {
      return;
    }
    const hasLine =
      this.routeGeoJson &&
      this.routeGeoJson.type === 'LineString' &&
      Array.isArray(this.routeGeoJson.coordinates) &&
      this.routeGeoJson.coordinates.length >= 2;

    if (hasLine) {
      const bounds = new mapboxgl.LngLatBounds();
      this.routeGeoJson.coordinates.forEach((coord: [number, number]) => {
        if (coord?.length === 2) {
          bounds.extend(coord);
        }
      });
      this.map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      return;
    }

    if (this.routeStops?.length) {
      this.fitToStopsOnly();
    }
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      this.mapLoaded &&
      (changes['routeGeoJson'] || changes['routeStops'] || changes['boardingPassengers'])
    ) {
      this.drawRoute();
    }

    if (this.mapLoaded && changes['driverLngLat']) {
      this.updateDriverMarkerAndProgress();
    }
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
    this.clearMarkerList(this.boardingMarkers);
    this.pathMarkers = [];
    this.stopMarkers = [];
    this.boardingMarkers = [];

    if (this.driverMarker) {
      this.driverMarker.remove();
      this.driverMarker = undefined;
    }

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

      // Avoid duplicate pins: terminal-approved stop markers already cover start/end.
      // Only show start/end markers when we don't have explicit stop markers.
      if (!this.routeStops || this.routeStops.length === 0) {
        this.addPathEndpoints();
      }
    }

    this.addStopMarkers();
    this.addBoardingMarker();

    if (!hasLine && this.routeStops?.length) {
      this.fitToStopsOnly();
    }

    this.updateDriverMarkerAndProgress();
  }

  private updateDriverMarkerAndProgress() {
    if (!this.mapLoaded || !this.map) return;
    if (!this.driverLngLat || this.driverLngLat.length !== 2) return;
    const [lng, lat] = this.driverLngLat;
    if (isNaN(lng) || isNaN(lat)) return;

    if (!this.driverMarker) {
      this.driverMarker = new mapboxgl.Marker({ color: '#2563eb', scale: 1.1 })
        .setLngLat([lng, lat])
        .setPopup(new mapboxgl.Popup().setHTML('<div style="padding:8px;"><strong>Bus</strong><br>Live position</div>'))
        .addTo(this.map);
    } else {
      this.driverMarker.setLngLat([lng, lat]);
    }

    // Only compute progress/off-route when we have a line geometry.
    const coords: [number, number][] | null =
      this.routeGeoJson?.type === 'LineString' && Array.isArray(this.routeGeoJson.coordinates)
        ? this.routeGeoJson.coordinates
        : null;

    if (!coords || coords.length < 2) {
      return;
    }

    const idx = this.findNearestCoordIndex([lng, lat], coords);
    if (idx <= 0) {
      this.setProgressLayers(coords, [], coords);
    } else if (idx >= coords.length - 1) {
      this.setProgressLayers(coords, coords, []);
    } else {
      const traveled = coords.slice(0, idx + 1);
      const remaining = coords.slice(idx);
      this.setProgressLayers(coords, traveled, remaining);
    }

    // Off-route check: distance from point to nearest segment
    const dM = this.distancePointToLineMeters([lng, lat], coords);
    const isOff = dM > 120; // ~120m threshold (GPS + map noise)
    if (isOff !== this.offRoute) {
      this.offRoute = isOff;
      this.offRouteChanged.emit(isOff);
    }
  }

  private setProgressLayers(full: [number, number][], traveled: [number, number][], remaining: [number, number][]) {
    // Replace single route layer with traveled/remaining for "shortening" effect.
    // If these layers already exist, update their sources.
    const ensureSource = (id: string, line: [number, number][]) => {
      const data = {
        type: 'Feature' as const,
        geometry: { type: 'LineString' as const, coordinates: line.length >= 2 ? line : full }
      };
      if (this.map.getSource(id)) {
        this.map.getSource(id).setData(data);
      } else {
        this.map.addSource(id, { type: 'geojson', data });
      }
    };

    // Remove the original layer if present (we want the two-tone progress)
    if (this.map.getLayer('route-line')) {
      this.map.removeLayer('route-line');
    }
    if (this.map.getSource('route')) {
      this.map.removeSource('route');
    }

    ensureSource('route-remaining', remaining.length >= 2 ? remaining : full);
    ensureSource('route-traveled', traveled.length >= 2 ? traveled : []);

    const ensureLayer = (id: string, source: string, color: string, width: number, opacity: number) => {
      if (this.map.getLayer(id)) return;
      this.map.addLayer({
        id,
        type: 'line',
        source,
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: { 'line-color': color, 'line-width': width, 'line-opacity': opacity }
      });
    };

    ensureLayer('route-remaining-line', 'route-remaining', '#2563eb', 6, 0.9);
    if (traveled.length >= 2) {
      ensureLayer('route-traveled-line', 'route-traveled', '#22c55e', 6, 0.85);
    } else if (this.map.getLayer('route-traveled-line')) {
      this.map.removeLayer('route-traveled-line');
    }
  }

  private findNearestCoordIndex(p: [number, number], coords: [number, number][]): number {
    let bestIdx = 0;
    let bestD = Number.POSITIVE_INFINITY;
    for (let i = 0; i < coords.length; i++) {
      const d = this.haversineMeters(p, coords[i]);
      if (d < bestD) {
        bestD = d;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  private haversineMeters(a: [number, number], b: [number, number]): number {
    const toRad = (x: number) => (x * Math.PI) / 180;
    const R = 6371000;
    const dLat = toRad(b[1] - a[1]);
    const dLng = toRad(b[0] - a[0]);
    const lat1 = toRad(a[1]);
    const lat2 = toRad(b[1]);
    const s =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
  }

  // Minimum distance from point to polyline segments (approx, in meters)
  private distancePointToLineMeters(p: [number, number], coords: [number, number][]): number {
    let best = Number.POSITIVE_INFINITY;
    for (let i = 0; i < coords.length - 1; i++) {
      const a = coords[i];
      const b = coords[i + 1];
      const d = this.distancePointToSegmentMeters(p, a, b);
      if (d < best) best = d;
    }
    return best;
  }

  // Project in local meters using equirectangular approximation around point latitude
  private distancePointToSegmentMeters(p: [number, number], a: [number, number], b: [number, number]): number {
    const lat0 = (p[1] * Math.PI) / 180;
    const mPerDegLat = 111132.92;
    const mPerDegLng = 111412.84 * Math.cos(lat0);
    const toXY = (c: [number, number]) => ({
      x: (c[0] - p[0]) * mPerDegLng,
      y: (c[1] - p[1]) * mPerDegLat,
    });
    const A = toXY(a);
    const B = toXY(b);
    const P = { x: 0, y: 0 };
    const vx = B.x - A.x;
    const vy = B.y - A.y;
    const wx = P.x - A.x;
    const wy = P.y - A.y;
    const c1 = vx * wx + vy * wy;
    if (c1 <= 0) return Math.hypot(P.x - A.x, P.y - A.y);
    const c2 = vx * vx + vy * vy;
    if (c2 <= c1) return Math.hypot(P.x - B.x, P.y - B.y);
    const t = c1 / c2;
    const projX = A.x + t * vx;
    const projY = A.y + t * vy;
    return Math.hypot(P.x - projX, P.y - projY);
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

  private addBoardingMarker() {
    const passengers = this.boardingPassengers || [];
    if (!passengers.length) {
      return;
    }

    let anchor: [number, number] | null = null;
    if (this.routeGeoJson?.coordinates?.length) {
      anchor = this.routeGeoJson.coordinates[0];
    }
    if (!anchor && this.routeStops?.length) {
      for (const s of this.routeStops) {
        anchor = this.stopLngLat(s);
        if (anchor) {
          break;
        }
      }
    }

    if (!anchor) {
      return;
    }

    const names = passengers
      .map((p) => p.commuter_name || p.public_ticket_id || 'Passenger')
      .filter(Boolean);
    const lines = names.slice(0, 12).map((n) => this.escapeHtml(String(n)));
    const more =
      names.length > 12 ? `<br><em>+${names.length - 12} more</em>` : '';
    const html = `<div style="padding:8px;"><strong>Boarding (${passengers.length})</strong><br>${lines.join('<br>')}${more}</div>`;

    const m = new mapboxgl.Marker({ color: '#a855f7', scale: 1.05 })
      .setLngLat(anchor)
      .setPopup(new mapboxgl.Popup({ maxWidth: '280px' }).setHTML(html))
      .addTo(this.map);
    this.boardingMarkers.push(m);
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
