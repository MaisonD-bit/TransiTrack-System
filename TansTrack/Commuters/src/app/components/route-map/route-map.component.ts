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
  @ViewChild('mapContainer', { static: true }) mapContainer!: ElementRef;
  map: any;
  mapLoaded: boolean = false;
  routeMarkers: any[] = []; // Store markers for cleanup
  private stopPinMarkers: any[] = [];
  private busSimSub: Subscription | null = null;
  private simulatedVehicleMarker: any = null;
  
  constructor(private busSimulatorService: BusSimulatorService) {}

  ngAfterViewInit() {
    // Point to the pre-built worker so the bundler never re-transpiles it.
    // Must be set before every new Map() call; absolute path avoids route-relative issues.
    (mapboxgl as any).workerUrl = '/assets/mapbox-gl-csp-worker.js';
    mapboxgl.accessToken = environment.mapbox?.accessToken || '';
    this.map = new mapboxgl.Map({
      container: this.mapContainer.nativeElement,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [123.920994, 10.311008], // Cebu coordinates
      zoom: 12,
      trackResize: true,
      preserveDrawingBuffer: false
    });

    // Add geolocate control to track user's real-time location
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true // Use GPS for better accuracy
      },
      trackUserLocation: true, // Track user location continuously
      showUserHeading: true, // Show direction the user is facing (on mobile)
      showUserLocation: true // Show user location on map
    });

    this.map.addControl(geolocateControl, 'top-right');

    // Handle geolocation errors (e.g., in emulator)
    geolocateControl.on('error', (e: any) => {
      console.warn('Geolocation not available (normal in emulator):', e.message);
      console.log('💡 Enable mock location in emulator: Extended Controls > Location');
    });

    this.map.on('load', () => {
      this.mapLoaded = true;
      this.drawRoute();
      // Try to trigger geolocation (will fail gracefully in emulator)
      geolocateControl.trigger();
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
  }

  ngOnChanges(changes: SimpleChanges) {
    if ((changes['routeGeoJson'] || changes['stopPins']) && this.mapLoaded) {
      this.drawRoute();
    }
  }

  drawRoute() {
    console.log('RouteMapComponent.drawRoute() called');
    console.log('  - mapLoaded:', this.mapLoaded);
    console.log('  - map exists:', !!this.map);
    console.log('  - routeGeoJson received:', this.routeGeoJson);
    
    if (!this.mapLoaded || !this.map) {
      console.log('Skipping drawRoute - map not ready');
      return;
    }

    // Remove previous route layer/source
    if (this.map.getLayer('route-line')) {
      this.map.removeLayer('route-line');
      console.log('Removed previous route-line layer');
    }
    if (this.map.getSource('route')) {
      this.map.removeSource('route');
      console.log('Removed previous route source');
    }

    // Remove previous markers
    this.routeMarkers.forEach(marker => marker.remove());
    this.routeMarkers = [];
    this.stopPinMarkers.forEach((m) => {
      try { m.remove(); } catch (e) {}
    });
    this.stopPinMarkers = [];
    console.log('Removed previous route markers');

    // Draw new route if valid routeGeoJson is provided
  console.log('Validating routeGeoJson for drawing:');
  console.log('  - routeGeoJson exists:', !!this.routeGeoJson);
  console.log('  - type is LineString:', this.routeGeoJson?.type === 'LineString');
  console.log('  - coordinates is array:', Array.isArray(this.routeGeoJson?.coordinates));
  console.log('  - coordinates length:', this.routeGeoJson?.coordinates?.length);

  if (this.routeGeoJson && 
    this.routeGeoJson.type === 'LineString' && 
    Array.isArray(this.routeGeoJson.coordinates) && 
    this.routeGeoJson.coordinates.length >= 2) {
        
      console.log('✅ GeoJSON validation passed - drawing route');

      // Add GeoJSON source
      console.log('Adding GeoJSON source with data:', {
        type: 'Feature',
        geometry: this.routeGeoJson
      });
      
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
          console.warn('Detected possible swapped coordinate order [lat,lng]; normalizing to [lng,lat]');
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
      console.log('✅ GeoJSON source added successfully');

      // Add line layer
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
      console.log('✅ Route line layer added successfully');

      // Fit map to route
      const bounds = new mapboxgl.LngLatBounds();
      console.log('Calculating bounds for coordinates:', numericCoords);
      numericCoords.forEach((coord: number[], index: number) => {
        console.log(`Processing coordinate ${index}:`, coord);
        if (coord && coord.length === 2) {
          bounds.extend(coord as [number, number]);
        } else {
          console.warn(`Skipped invalid coordinate ${index}:`, coord);
        }
      });
      
      console.log('Final bounds:', bounds);
      this.map.fitBounds(bounds, { padding: 40, maxZoom: 14 });
      console.log('✅ Map fitted to route bounds');

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
            console.log('Normalized provided startCoord (swapped) from', this.startCoord, 'to', normalizedStartInput);
          } else {
            normalizedStartInput = [a, b];
            console.log('Using provided startCoord as-is:', normalizedStartInput);
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
            console.log('Normalized provided endCoord (swapped) from', this.endCoord, 'to', normalizedEndInput);
          } else {
            normalizedEndInput = [a, b];
            console.log('Using provided endCoord as-is:', normalizedEndInput);
          }
        }
      } catch (e) {
        console.warn('Failed to normalize provided endCoord:', this.endCoord, e);
      }

      // Add route markers (start, end, and waypoints) using normalized coordinates
      // Pass the normalized input coords so markers align with the route
      this.addRouteMarkers(numericCoords, normalizedStartInput, normalizedEndInput);

      this.drawStopPins();

      // Start simulated bus movement along the route (if service available)
      try {
        // Clean existing simulation
        if (this.busSimSub) { this.busSimSub.unsubscribe(); this.busSimSub = null; }
  if (this.busSimulatorService && numericCoords && numericCoords.length) {
          // create a simulated vehicle marker if not present
            if (!this.simulatedVehicleMarker) {
            // Use Mapbox built-in marker for consistency and to avoid zoom/pan issues
            // Blue color for the moving bus/vehicle
              this.simulatedVehicleMarker = new mapboxgl.Marker({ 
                color: '#1E90FF', 
                scale: 1.0 
              }).setLngLat(numericCoords[0] as [number, number]).addTo(this.map);
          }

          // subscribe to simulated positions
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
      console.log('❌ GeoJSON validation failed - route not drawn');
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
  console.log('Start marker - raw providedStart:', providedStart, 'component startCoord:', this.startCoord, 'using:', startCoord);
    // Use the same simple Mapbox marker used in the driver's map for stability
    // (color + scale) — this avoids custom DOM/SVG alignment issues when zooming.
    const startMarker = new mapboxgl.Marker({ color: '#22c55e', scale: 1.2 })
      .setLngLat(startCoord as [number, number])
      .setPopup(new mapboxgl.Popup().setHTML('<strong>Start Point</strong>'))
      .addTo(this.map);
    console.log('Added start marker at', startCoord, '(using Mapbox built-in marker)');
    this.routeMarkers.push(startMarker);

    // Add end marker (red) - only if different from start
    if (coordinates.length > 1) {
  // prefer normalized providedEnd, then component input, then route last coord
  const endCoord = providedEnd || (this.endCoord && this.endCoord.length === 2 ? this.endCoord as [number, number] : coordinates[coordinates.length - 1]);
  console.log('End marker - raw providedEnd:', providedEnd, 'component endCoord:', this.endCoord, 'using:', endCoord);
      // Use built-in Mapbox marker for end as well to match driver's map
      const endMarker = new mapboxgl.Marker({ color: '#ef4444', scale: 1.2 })
        .setLngLat(endCoord as [number, number])
        .setPopup(new mapboxgl.Popup().setHTML('<strong>End Point</strong>'))
        .addTo(this.map);
      console.log('Added end marker at', endCoord, '(using Mapbox built-in marker)');
      this.routeMarkers.push(endMarker);
    }

    // vehicle marker is handled by simulator (simulatedVehicleMarker)
  }
}