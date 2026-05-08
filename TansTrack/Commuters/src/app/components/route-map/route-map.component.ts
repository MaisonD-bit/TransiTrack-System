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
  @Input() stopPins: { lng: number; lat: number; label?: string }[] = [];
  /** Live / estimated bus positions from operator schedules (commuter app). */
  @Input() liveBusMarkers: { lng: number; lat: number; label: string; color: string; scheduleId?: number; selected?: boolean }[] = [];
  /**
   * Distinct route lines per active bus (same geometry, different color/offset).
   * Lets commuters visually distinguish multiple active buses on the same route.
   */
  @Input() routeLineVariants: { id: number; color: string; offsetPx: number; label: string; selected: boolean }[] = [];
  /** When true, skip the demo bus animation (use live markers instead). */
  @Input() disableSimulator: boolean = true;
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  mapLoaded: boolean = false;
  routeMarkers: any[] = []; // Store markers for cleanup
  private stopPinMarkers: any[] = [];
  private liveBusMapMarkers: any[] = [];
  private variantLayerIds: string[] = [];
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
      this.drawRoute();
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
    this.clearLiveBusMarkers();
  }

  ngOnChanges(changes: SimpleChanges) {
    if (!this.mapLoaded) {
      return;
    }
    // Redrawing the full route restarts bus simulation + interpolation — only when geometry changes.
    if (changes['routeGeoJson']) {
      this.drawRoute();
      return;
    }
    if (changes['stopPins']) {
      this.drawStopPins();
    }
    if (changes['liveBusMarkers'] || changes['disableSimulator']) {
      this.refreshLiveBusMarkers();
    }
    if (changes['routeLineVariants']) {
      this.refreshRouteLineVariants();
    }
  }

  private clearRouteLineVariants(): void {
    if (!this.mapLoaded || !this.map) return;
    this.variantLayerIds.forEach((id) => {
      try {
        if (this.map.getLayer(id)) this.map.removeLayer(id);
      } catch {}
    });
    this.variantLayerIds = [];
  }

  private refreshRouteLineVariants(): void {
    if (!this.mapLoaded || !this.map) return;
    if (!this.map.getSource('route')) return;

    this.clearRouteLineVariants();
    const variants = Array.isArray(this.routeLineVariants) ? this.routeLineVariants : [];
    if (!variants.length) return;

    variants.forEach((v) => {
      const id = `route-line-variant-${v.id}`;
      try {
        this.map.addLayer({
          id,
          type: 'line',
          source: 'route',
          layout: { 'line-join': 'round', 'line-cap': 'round' },
          paint: {
            'line-color': v.color,
            'line-width': v.selected ? 7 : 5,
            'line-opacity': v.selected ? 0.95 : 0.55,
            'line-translate': [v.offsetPx || 0, 0],
            'line-translate-anchor': 'viewport',
          },
        });
        this.variantLayerIds.push(id);
      } catch {
        // ignore
      }
    });
  }

  private clearLiveBusMarkers(): void {
    this.liveBusMapMarkers.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    this.liveBusMapMarkers = [];
  }

  private refreshLiveBusMarkers(): void {
    if (!this.mapLoaded || !this.map) {
      return;
    }
    this.clearLiveBusMarkers();
    if (!this.liveBusMarkers?.length) {
      return;
    }
    this.liveBusMarkers.forEach((b) => {
      const el = document.createElement('div');
      // Bus icon marker (instead of pin/dot).
      const size = 30;
      const ring = b.selected ? '0 0 0 4px rgba(251, 191, 36, 0.8)' : '0 0 0 2px rgba(255,255,255,.9)';
      el.style.cssText = `width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;`;
      el.innerHTML = `
        <div style="
          width:${size}px;height:${size}px;border-radius:999px;
          background: ${b.color};
          box-shadow: ${ring}, 0 6px 14px rgba(0,0,0,.22);
          display:flex;align-items:center;justify-content:center;
        ">
          <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none">
            <path d="M7 4h10a3 3 0 0 1 3 3v9a2 2 0 0 1-2 2h-1v1a1 1 0 1 1-2 0v-1H9v1a1 1 0 1 1-2 0v-1H6a2 2 0 0 1-2-2V7a3 3 0 0 1 3-3Z" fill="rgba(255,255,255,.95)"/>
            <path d="M7 7h10v5H7V7Z" fill="rgba(0,0,0,.18)"/>
            <circle cx="8" cy="16" r="1.2" fill="rgba(0,0,0,.35)"/>
            <circle cx="16" cy="16" r="1.2" fill="rgba(0,0,0,.35)"/>
          </svg>
        </div>`;
      const mk = new mapboxgl.Marker({ element: el })
        .setLngLat([b.lng, b.lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(`<strong>${b.label}</strong>`))
        .addTo(this.map);
      this.liveBusMapMarkers.push(mk);
    });
  }

  drawRoute() {
    if (!this.mapLoaded || !this.map) {
      return;
    }

    if (this.map.getLayer('route-line')) {
      this.map.removeLayer('route-line');
    }
    this.clearRouteLineVariants();
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
      const numericCoords: number[][] = this.routeGeoJson.coordinates
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
          'line-color': '#1f2937',
          'line-width': 4,
          'line-opacity': 0.25
        }
      });

      this.refreshRouteLineVariants();

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

          this.busSimSub = this.busSimulatorService.simulateAlongLine(numericCoords, 800).subscribe((pos: { lng: number; lat: number; index: number }) => {
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

  drawStopPins() {
    if (!this.mapLoaded || !this.map || !this.stopPins?.length) {
      return;
    }
    this.stopPinMarkers.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    this.stopPinMarkers = [];
    this.stopPins.forEach((p, i) => {
      const el = document.createElement('div');
      el.style.cssText =
        'background:#f97316;color:#fff;border-radius:50%;min-width:24px;height:24px;padding:0 6px;display:flex;align-items:center;justify-content:center;font-size:11px;font-weight:bold;border:2px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)';
      el.textContent = String(i + 1);
      const mk = new mapboxgl.Marker({ element: el })
        .setLngLat([p.lng, p.lat])
        .setPopup(new mapboxgl.Popup({ offset: 12 }).setHTML(`<strong>${p.label || 'Stop ' + (i + 1)}</strong>`))
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