import { Component, Input, AfterViewInit, ElementRef, ViewChild, OnChanges, SimpleChanges, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import mapboxgl from 'mapbox-gl';
import { environment } from '../../../environments/environment';
import { BusSimulatorService } from '../../services/bus-simulator.service';
import { Subscription } from 'rxjs';

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
  @Input() startCoord: [number, number] | null | undefined = null;
  @Input() endCoord: [number, number] | null | undefined = null;
  /** Terminal-manager stop pins (numbered) along the route */
  @Input() stopPins: { lng: number; lat: number; label?: string; etaMin?: number }[] = [];
  /** Live / estimated bus positions from operator schedules (commuter app). */
  @Input() liveBusMarkers: { lng: number; lat: number; label: string; color: string; scheduleId?: number; selected?: boolean; status?: string }[] = [];
  /** When true, skip the demo bus animation (use live markers instead). */
  @Input() disableSimulator: boolean = false;
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  mapLoaded: boolean = false;
  routeMarkers: any[] = []; // Store markers for cleanup
  private stopPinMarkers: any[] = [];
  private liveBusMarkerIndex = new Map<string, any>();
  private liveBusLerpSubs = new Map<string, Subscription>();
  private liveBusSimSubs: Subscription[] = [];
  private busSimSub: Subscription | null = null;
  private simulatedVehicleMarker: any = null;
  
  constructor(private busSimulatorService: BusSimulatorService) {}

  ngAfterViewInit() {
    // Resolve worker relative to index (required for Capacitor file:// and subpaths).
    try {
      (mapboxgl as any).workerUrl = new URL(
        'assets/mapbox-gl-csp-worker.js',
        document.baseURI
      ).href;
    } catch {
      (mapboxgl as any).workerUrl = 'assets/mapbox-gl-csp-worker.js';
    }
    mapboxgl.accessToken = environment.mapbox?.accessToken || '';
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [123.920994, 10.311008], // Cebu coordinates
      zoom: 12,
      trackResize: true,
      preserveDrawingBuffer: false,
      antialias: false,
    });

    // One-shot locate only — continuous tracking + heading is heavy on mobile WebViews.
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: { enableHighAccuracy: false },
      trackUserLocation: false,
      showUserHeading: false,
      showUserLocation: true,
    });

    this.map.addControl(geolocateControl, 'top-right');

    geolocateControl.on('error', (e: any) => {
      if (!environment.production) {
        console.warn('Geolocation not available:', e?.message);
      }
    });

    this.map.on('load', () => {
      this.mapLoaded = true;
      this.drawRoute().catch(e => console.warn('drawRoute error:', e));
    });
  }

  ngOnDestroy() {
    if (this.busSimSub) {
      this.busSimSub.unsubscribe();
      this.busSimSub = null;
    }
    if (this.simulatedVehicleMarker) {
      try { this.simulatedVehicleMarker.remove(); } catch (e) {}
      this.simulatedVehicleMarker = null;
    }
    this.clearLiveBusMarkers(); // also unsubscribes liveBusSimSubs
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.mapLoaded) {
      return;
    }
    // Redrawing the full route restarts bus simulation + interpolation — only when geometry changes.
    if (changes['routeGeoJson']) {
      this.drawRoute().catch(e => console.warn('drawRoute error:', e));
      return;
    }
    if (changes['stopPins'] && !changes['routeGeoJson']) {
      this.drawStopPins();
    }
    if (changes['liveBusMarkers'] || changes['disableSimulator']) {
      this.refreshLiveBusMarkers();
      if (this.disableSimulator) {
        if (this.busSimSub) {
          this.busSimSub.unsubscribe();
          this.busSimSub = null;
        }
        if (this.simulatedVehicleMarker) {
          try { this.simulatedVehicleMarker.remove(); } catch (e) {}
          this.simulatedVehicleMarker = null;
        }
      }
    }
  }

  /** Fetch road-following geometry from Mapbox Directions API. Returns null on failure. */
  private async fetchRoadGeometry(waypoints: [number, number][]): Promise<number[][] | null> {
    const token = environment.mapbox?.accessToken;
    if (!token || waypoints.length < 2) return null;
    // Mapbox Directions supports up to 25 waypoints; clamp if needed
    const pts = waypoints.slice(0, 25);
    const coords = pts.map(([lng, lat]) => `${lng},${lat}`).join(';');
    const url =
      `https://api.mapbox.com/directions/v5/mapbox/driving/${coords}` +
      `?geometries=geojson&overview=full&access_token=${token}`;
    try {
      const res = await fetch(url);
      const data = await res.json();
      if (data.routes?.[0]?.geometry?.coordinates?.length >= 2) {
        return data.routes[0].geometry.coordinates;
      }
    } catch (e) {
      console.warn('Mapbox Directions fetch failed:', e);
    }
    return null;
  }

  private clearLiveBusMarkers(): void {
    this.liveBusSimSubs.forEach(s => s.unsubscribe());
    this.liveBusSimSubs = [];
    this.liveBusLerpSubs.forEach(s => s.unsubscribe());
    this.liveBusLerpSubs.clear();
    this.liveBusMarkerIndex.forEach((m: any) => { try { m.remove(); } catch (e) {} });
    this.liveBusMarkerIndex.clear();
  }

  private findNearestCoordIndex(coords: number[][], lng: number, lat: number): number {
    let nearest = 0, minDist = Infinity;
    for (let i = 0; i < coords.length; i++) {
      const dx = coords[i][0] - lng, dy = coords[i][1] - lat;
      const d = dx * dx + dy * dy;
      if (d < minDist) { minDist = d; nearest = i; }
    }
    return nearest;
  }

  private refreshLiveBusMarkers(): void {
    if (!this.mapLoaded || !this.map) return;

    // Build a map of incoming buses keyed by scheduleId (or label as fallback)
    const incoming = new Map<string, typeof this.liveBusMarkers[number]>();
    (this.liveBusMarkers || []).forEach(b => incoming.set(String(b.scheduleId ?? b.label), b));

    // Remove markers for buses no longer in the list
    const gone: string[] = [];
    this.liveBusMarkerIndex.forEach((_: any, key: string) => { if (!incoming.has(key)) gone.push(key); });
    gone.forEach(key => {
      try { this.liveBusMarkerIndex.get(key)?.remove(); } catch (e) {}
      this.liveBusMarkerIndex.delete(key);
    });

    // Route coords for local simulation (may be null if no geometry yet)
    const routeCoords: number[][] | null = (
      this.routeGeoJson?.type === 'LineString' &&
      Array.isArray(this.routeGeoJson?.coordinates) &&
      this.routeGeoJson.coordinates.length >= 2
    ) ? this.routeGeoJson.coordinates : null;

    // Update existing markers or create new ones, then run a local simulation
    // at the same speed as the driver (400ms/step) so both markers move identically
    incoming.forEach((b, key) => {
      // Cancel any existing simulation for this bus
      const prevSub = this.liveBusLerpSubs.get(key);
      if (prevSub) { prevSub.unsubscribe(); this.liveBusLerpSubs.delete(key); }

      let marker = this.liveBusMarkerIndex.get(key);
      if (!marker) {
        marker = new mapboxgl.Marker({ color: b.color || '#0074D9', scale: b.selected ? 1.5 : 1.0 })
          .setLngLat([b.lng, b.lat])
          .setPopup(new mapboxgl.Popup({ offset: 30 }).setHTML(`<strong>${b.label}</strong>`))
          .addTo(this.map);
        this.liveBusMarkerIndex.set(key, marker);
      } else {
        // Snap to the freshly polled position
        marker.setLngLat([b.lng, b.lat]);
      }

      // Only animate active buses — accepted buses stay fixed at route start
      if (routeCoords && b.status === 'active') {
        const startIdx = this.findNearestCoordIndex(routeCoords, b.lng, b.lat);
        const mk = marker;
        const simSub = this.busSimulatorService.simulateAlongLine(routeCoords, 400, startIdx, this.stopPins).subscribe({
          next: (pos: { lng: number; lat: number; index: number }) => {
            try { mk.setLngLat([pos.lng, pos.lat]); } catch (e) {}
          },
        });
        this.liveBusLerpSubs.set(key, simSub);
      }
    });

  }

  async drawRoute() {
    if (!this.mapLoaded || !this.map) {
      return;
    }

    if (this.map.getLayer('route-line')) {
      this.map.removeLayer('route-line');
    }
    if (this.map.getSource('route')) {
      this.map.removeSource('route');
    }

    this.routeMarkers.forEach(marker => marker.remove());
    this.routeMarkers = [];
    this.stopPinMarkers.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    this.stopPinMarkers = [];

  if (this.routeGeoJson &&
    this.routeGeoJson.type === 'LineString' &&
    Array.isArray(this.routeGeoJson.coordinates) &&
    this.routeGeoJson.coordinates.length >= 2) {

      // Normalize coordinates to numeric [lng, lat] pairs (DB sometimes stores as strings)
      let numericCoords: number[][] = this.routeGeoJson.coordinates
        .map((c: any) => {
          if (!c || c.length < 2) return null;
          const lng = typeof c[0] === 'string' ? parseFloat(c[0]) : c[0];
          const lat = typeof c[1] === 'string' ? parseFloat(c[1]) : c[1];
          if (isNaN(lng) || isNaN(lat)) return null;
          return [lng, lat];
        })
        .filter((c: any) => c !== null);

      // Detect if coordinates are stored as [lat, lng] instead of [lng, lat]
      let coordsWereSwapped = false;
      if (numericCoords.length && numericCoords[0]) {
        const sample = numericCoords[0];
        // In the Philippines we expect longitude ~ 100..140 and latitude ~ -10..30
        const first = Number(sample[0]);
        const second = Number(sample[1]);
        if (Math.abs(first) <= 90 && Math.abs(second) > 90) {
          for (let i = 0; i < numericCoords.length; i++) {
            const s = numericCoords[i];
            numericCoords[i] = [s[1], s[0]];
          }
          coordsWereSwapped = true;
        }
      }

      if (numericCoords.length < 2) {
        console.warn('After normalization, route has fewer than 2 valid coordinates. Aborting draw.');
        return;
      }

      // Sparse geometry (straight-line fallback from seeder) — upgrade to real road geometry.
      // Dense Mapbox routes have hundreds of points; straight-line fallbacks have only the stop count.
      if (numericCoords.length <= 20) {
        // Build waypoints: prefer stop pins (they include intermediate stops), else start+end
        let waypoints: [number, number][];
        if (this.stopPins?.length >= 2) {
          waypoints = this.stopPins.map(p => [p.lng, p.lat] as [number, number]);
        } else if (this.startCoord && this.endCoord) {
          waypoints = [this.startCoord, this.endCoord];
        } else {
          waypoints = numericCoords.map(c => [c[0], c[1]] as [number, number]);
        }
        const roadCoords = await this.fetchRoadGeometry(waypoints);
        if (roadCoords && roadCoords.length >= 2) {
          numericCoords = roadCoords;
        }
      }

      this.map.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: numericCoords }
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
      numericCoords.forEach((coord: number[]) => {
        if (coord && coord.length === 2) {
          bounds.extend(coord as [number, number]);
        }
      });

      this.map.fitBounds(bounds, { padding: 40, maxZoom: 14 });

      // If the stored startCoord/endCoord were provided via @Input, normalize them
      // using the same heuristic so they match the route coordinates ordering.
      let normalizedStartInput: [number, number] | null = null;
      let normalizedEndInput: [number, number] | null = null;

      try {
        if (this.startCoord && this.startCoord.length === 2) {
          const a = Number(this.startCoord[0]);
          const b = Number(this.startCoord[1]);
          // If coords were swapped earlier, swap these too; otherwise use heuristic
          if (coordsWereSwapped || (Math.abs(a) <= 90 && Math.abs(b) > 90)) {
            normalizedStartInput = [b, a];
          } else {
            normalizedStartInput = [a, b];
          }
        }
      } catch (e) {
        console.warn('Failed to normalize provided startCoord:', this.startCoord, e);
      }

      try {
        if (this.endCoord && this.endCoord.length === 2) {
          const a = Number(this.endCoord[0]);
          const b = Number(this.endCoord[1]);
          if (coordsWereSwapped || (Math.abs(a) <= 90 && Math.abs(b) > 90)) {
            normalizedEndInput = [b, a];
          } else {
            normalizedEndInput = [a, b];
          }
        }
      } catch (e) {
        console.warn('Failed to normalize provided endCoord:', this.endCoord, e);
      }

      // Add route markers (start, end, and waypoints) using normalized coordinates
      // Pass the normalized input coords so markers align with the route
      this.addRouteMarkers(numericCoords, normalizedStartInput, normalizedEndInput);

      this.drawStopPins();
      this.refreshLiveBusMarkers();

      // Demo bus only when no live fleet is shown
      try {
        if (this.busSimSub) {
          this.busSimSub.unsubscribe();
          this.busSimSub = null;
        }
        if (this.simulatedVehicleMarker) {
          try { this.simulatedVehicleMarker.remove(); } catch (e) {}
          this.simulatedVehicleMarker = null;
        }
        if (!this.disableSimulator && this.busSimulatorService && numericCoords && numericCoords.length) {
          this.simulatedVehicleMarker = new mapboxgl.Marker({
            color: '#1E90FF',
          }).setLngLat(numericCoords[0] as [number, number]).addTo(this.map);

          this.busSimSub = this.busSimulatorService.simulateAlongLine(numericCoords, 800, 0, this.stopPins).subscribe((pos: { lng: number; lat: number; index: number }) => {
            try {
              if (this.simulatedVehicleMarker) {
                this.simulatedVehicleMarker.setLngLat([pos.lng, pos.lat] as [number, number]);
              }
            } catch (err) {
              console.warn('Error moving simulated vehicle marker:', err);
            }
          });
        }
      } catch (err) {
        console.warn('Bus simulation start failed:', err);
      }
      
    } else {
      this.drawStopPins();
    }
  }

  private formatEta(minutes: number): string {
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `~${h} hr` : `~${h} hr ${m} min`;
  }

  drawStopPins() {
    if (!this.mapLoaded || !this.map || !this.stopPins?.length) {
      return;
    }
    this.stopPinMarkers.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    this.stopPinMarkers = [];
    const total = this.stopPins.length;
    let stopNumber = 0;
    this.stopPins.forEach((p, i) => {
      // First stop = terminal (green route marker), last = endpoint (red route marker) — skip both.
      if (i === 0 || i === total - 1) return;
      stopNumber++;
      const el = document.createElement('div');
      el.style.cssText = 'display:flex;flex-direction:column;align-items:center;gap:2px;';

      const circle = document.createElement('div');
      circle.style.cssText =
        'background:#f97316;color:#fff;border-radius:50%;min-width:24px;height:24px;padding:0 6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)';
      circle.textContent = String(stopNumber);
      el.appendChild(circle);

      if (p.etaMin != null) {
        const etaTag = document.createElement('div');
        etaTag.style.cssText =
          'background:#fff;color:#f97316;font-size:9px;font-weight:700;padding:1px 5px;border-radius:8px;border:1px solid #f97316;box-shadow:0 1px 3px rgba(0,0,0,.2);white-space:nowrap;line-height:1.4';
        etaTag.textContent = this.formatEta(p.etaMin);
        el.appendChild(etaTag);
      }

      const popupHtml = `<div style="padding:4px"><strong>${p.label || 'Stop ' + stopNumber}</strong>${p.etaMin != null ? `<br><span style="color:#f97316">ETA: ${this.formatEta(p.etaMin)}</span>` : ''}</div>`;
      const mk = new mapboxgl.Marker({ element: el, anchor: 'top' })
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(popupHtml))
        .addTo(this.map);
      this.stopPinMarkers.push(mk);
    });
  }

  addRouteMarkers(numericCoords: number[][], providedStart?: [number, number] | null, providedEnd?: [number, number] | null) {
    if (!numericCoords || numericCoords.length === 0) return;

    const coordinates = numericCoords;

    // Add start marker (A label similar to transit)
  // prefer the normalized providedStart (from caller) first, then component input, then route first coord
  const startCoord = providedStart || (this.startCoord && this.startCoord.length === 2 ? this.startCoord as [number, number] : coordinates[0]);
    // Use the same simple Mapbox marker used in the driver's map for stability
    // (color + scale) — this avoids custom DOM/SVG alignment issues when zooming.
    const startMarker = new mapboxgl.Marker({ color: '#22c55e' })
      .setLngLat(startCoord as [number, number])
      .setPopup(new mapboxgl.Popup().setHTML('<strong>Start Point</strong>'))
      .addTo(this.map);
    this.routeMarkers.push(startMarker);

    // Add end marker (red) - only if different from start
    if (coordinates.length > 1) {
  // prefer normalized providedEnd, then component input, then route last coord
  const endCoord = providedEnd || (this.endCoord && this.endCoord.length === 2 ? this.endCoord as [number, number] : coordinates[coordinates.length - 1]);
      // Use built-in Mapbox marker for end as well to match driver's map
      const endMarker = new mapboxgl.Marker({ color: '#ef4444' })
        .setLngLat(endCoord as [number, number])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>End Point</strong>'))
        .addTo(this.map);
      this.routeMarkers.push(endMarker);
    }

    // vehicle marker is handled by simulator (simulatedVehicleMarker)
  }
}