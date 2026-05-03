import { Component, Input, AfterViewInit, ElementRef, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
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

  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  mapLoaded = false;
  private pathMarkers: any[] = [];
  private stopMarkers: any[] = [];
  private boardingMarkers: any[] = [];

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
    });
  }

  ngOnChanges(changes: SimpleChanges) {
    if (
      this.mapLoaded &&
      (changes['routeGeoJson'] || changes['routeStops'] || changes['boardingPassengers'])
    ) {
      this.drawRoute();
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
    this.addBoardingMarker();

    if (!hasLine && this.routeStops?.length) {
      this.fitToStopsOnly();
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
