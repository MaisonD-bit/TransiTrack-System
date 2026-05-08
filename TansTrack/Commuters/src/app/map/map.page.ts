import {
  AfterViewInit,
  Component,
  ElementRef,
  OnDestroy,
  OnInit,
  ViewChild,
} from '@angular/core';
import * as mapboxgl from 'mapbox-gl';
import { environment } from '../../environments/environment';
import { CommuterService, LiveRoute } from '../services/commuter.service';
import { Subscription } from 'rxjs';
import { ActivatedRoute } from '@angular/router';

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  standalone: false
})
export class MapPage implements OnInit, AfterViewInit, OnDestroy {
  @ViewChild('mapHost', { static: false }) mapHost?: ElementRef<HTMLElement>;

  map: mapboxgl.Map | undefined;
  busMarkers: mapboxgl.Marker[] = [];
  selectedRoute: string = '';
  /** Focus this route when navigated from Home "Track Route". */
  focusRouteId: string | null = null;
  /** Focus this live schedule (bus trip) when selected. */
  focusScheduleId: number | null = null;
  private liveBusPollTimer: ReturnType<typeof setInterval> | null = null;
  
  // Real-time data
  routes: LiveRoute[] = [];
  private subscriptions: Subscription[] = [];
  
  // Commuter location and destination
  commuterLocation: { lat: number; lng: number } | null = null;
  commuterMarker: mapboxgl.Marker | null = null;
  selectedDestination: { lat: number; lng: number } | null = null;
  showNavigationLine: boolean = false;

  constructor(private commuterService: CommuterService, private route: ActivatedRoute) {}

  ngOnInit() {
    this.route.queryParamMap.subscribe((q) => {
      const rid = q.get('routeId');
      const sid = q.get('scheduleId');
      this.focusRouteId = rid ? String(rid) : null;
      this.focusScheduleId = sid != null && sid !== '' ? Number(sid) : null;
      // If map is already ready, refresh markers now.
      if (this.map) {
        this.startLiveBusPoll();
      }
    });
    this.subscribeToRealTimeData();
  }

  ngAfterViewInit(): void {
    // DOM must exist before Mapbox runs (ngOnInit is too early). Required for Capacitor WebView.
    this.initializeMap();
  }

  subscribeToRealTimeData() {
    // Subscribe to routes updates
    const routesSub = this.commuterService.routes$.subscribe(routes => {
      this.routes = routes.map(route => ({
        ...route,
        color: this.getRouteColor(route.id)
      }));
      this.updateMapRoutes();
    });

    this.subscriptions.push(routesSub);
  }

  getCurrentLocation() {
    // This method is no longer needed - Mapbox GeolocateControl handles location tracking
    // Kept for backwards compatibility but can be removed
    // The GeolocateControl in initializeMap() now handles all location tracking
  }

  initializeMap() {
    const el = this.mapHost?.nativeElement;
    if (!el) {
      return;
    }

    (mapboxgl as any).accessToken = environment.mapbox.accessToken;
    try {
      (mapboxgl as any).workerUrl = new URL(
        'assets/mapbox-gl-csp-worker.js',
        document.baseURI
      ).href;
    } catch {
      (mapboxgl as any).workerUrl = 'assets/mapbox-gl-csp-worker.js';
    }

    this.map = new mapboxgl.Map({
      container: el,
      style: 'mapbox://styles/mapbox/streets-v12',
      center: [123.920994, 10.311008], // Cebu North Bus Terminal (SM City)
      zoom: 12,
      trackResize: true
    });

    // Mapbox GeolocateControl for real-time location tracking
    const geolocateControl = new mapboxgl.GeolocateControl({
      positionOptions: {
        enableHighAccuracy: true // Use GPS for better accuracy
      },
      trackUserLocation: true, // Track user location continuously
      showUserHeading: true, // Show direction the user is facing (on mobile)
      showUserLocation: true // Show blue dot for user location
    });

    this.map.addControl(geolocateControl, 'top-right');

    // Add navigation controls (zoom in/out buttons)
    this.map.addControl(new mapboxgl.NavigationControl(), 'top-right');

    this.map.on('load', () => {
      this.addRouteLines();
      this.startLiveBusPoll();
      
     
      geolocateControl.trigger();
    });

    // Listen to geolocate events to update commuter location
    geolocateControl.on('geolocate', (e: any) => {
      this.commuterLocation = {
        lat: e.coords.latitude,
        lng: e.coords.longitude
      };
      console.log('Commuter location updated:', this.commuterLocation);
    });

    // Handle geolocation errors (e.g., in emulator without mock location)
    geolocateControl.on('error', (e: any) => {
      console.warn('Geolocation error:', e.message);
      console.log('💡 Tip: In emulator, enable mock location via Extended Controls > Location');
      
      // Fallback to default location (Cebu City, Philippines)
      this.commuterLocation = {
        lat: 10.3157,
        lng: 123.9068
      };
      
      // Center map on fallback location
      if (this.map) {
        this.map.flyTo({
          center: [this.commuterLocation.lng, this.commuterLocation.lat],
          zoom: 13
        });
      }
      
      console.log('Using fallback location (Cebu City):', this.commuterLocation);
    });
  }

  
  addRouteLines() {
    // Load actual route data from API and display navigation lines
    const focus = this.focusRouteId
      ? this.routes.find((r) => String(r.id) === String(this.focusRouteId))
      : null;

    if (focus) {
      this.loadAndDisplayRoute(focus);
      return;
    }

    this.routes.forEach((route) => this.loadAndDisplayRoute(route));
  }

  private stopLiveBusPoll(): void {
    if (this.liveBusPollTimer) {
      clearInterval(this.liveBusPollTimer);
      this.liveBusPollTimer = null;
    }
  }

  private startLiveBusPoll(): void {
    this.stopLiveBusPoll();
    if (!this.focusRouteId) {
      return;
    }
    this.refreshLiveBusMarkers();
    this.liveBusPollTimer = setInterval(() => this.refreshLiveBusMarkers(), 5000);
  }

  private refreshLiveBusMarkers(): void {
    if (!this.map || !this.focusRouteId) return;

    const terminal = this.commuterService.getTerminal();
    this.commuterService.getLiveBuses(String(this.focusRouteId), terminal).subscribe({
      next: (res) => {
        const buses = Array.isArray(res?.buses) ? res.buses : [];
        const filtered = this.focusScheduleId != null
          ? buses.filter((b: any) => b.schedule_id === this.focusScheduleId)
          : buses;

        // clear old markers
        this.busMarkers.forEach((m) => {
          try { m.remove(); } catch {}
        });
        this.busMarkers = [];

        filtered.forEach((b: any) => {
          if (!b?.position) return;
          const lng = Number(b.position.lng);
          const lat = Number(b.position.lat);
          if (!Number.isFinite(lng) || !Number.isFinite(lat)) return;

          const selected = this.focusScheduleId != null && b.schedule_id === this.focusScheduleId;
          const color = b.is_full ? '#dc2626' : b.status === 'active' ? '#16a34a' : '#2563eb';

          const el = document.createElement('div');
          const size = 32;
          const ring = selected ? '0 0 0 4px rgba(251, 191, 36, 0.85)' : '0 0 0 2px rgba(255,255,255,.9)';
          el.style.cssText = `width:${size}px;height:${size}px;display:flex;align-items:center;justify-content:center;`;
          el.innerHTML = `
            <div style="
              width:${size}px;height:${size}px;border-radius:999px;
              background: ${color};
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

          const label = `${b.bus_number || 'Bus'} · ${b.operator_company || ''} · ${b.driver_name || ''}${b.is_full ? ' · FULL' : ''}`;
          const popup = new mapboxgl.Popup({ offset: 12 }).setHTML(`<strong>${label}</strong>`);
          const mk = new mapboxgl.Marker({ element: el }).setLngLat([lng, lat]).setPopup(popup).addTo(this.map!);
          this.busMarkers.push(mk);
        });
      },
      error: () => {
        // ignore transient errors (ngrok / network)
      },
    });
  }

  async loadAndDisplayRoute(route: any) {
    try {
      // Only display routes with real geometry data from API
      if (route.geometry) {
        let geoJson: any;
        if (typeof route.geometry === 'string') {
          geoJson = JSON.parse(route.geometry);
        } else {
          geoJson = route.geometry;
        }
        
        if (geoJson && geoJson.features && geoJson.features[0] && geoJson.features[0].geometry) {
          const coordinates = geoJson.features[0].geometry.coordinates;
          this.addRouteLineToMap(route, coordinates);
          return;
        }
      }
      
      // No geometry data available - skip this route
      console.warn(`Route ${route.id} has no geometry data, skipping display`);
    } catch (error) {
      console.error('Error loading route geometry:', error);
    }
  }

  addRouteLineToMap(route: any, coordinates: number[][]) {
    this.map!.addSource(`route-${route.id}`, {
      'type': 'geojson',
      'data': {
        'type': 'Feature',
        'properties': {},
        'geometry': {
          'type': 'LineString',
          'coordinates': coordinates
        }
      }
    });

    this.map!.addLayer({
      'id': `route-${route.id}`,
      'type': 'line',
      'source': `route-${route.id}`,
      'layout': {
        'line-join': 'round',
        'line-cap': 'round'
      },
      'paint': {
        'line-color': route.color,
        'line-width': 4,
        'line-opacity': 0.7
      }
    });
  }

  filterByRoute(routeId: string | number | undefined) {
    const selectedRouteId = String(routeId || '');
    this.selectedRoute = selectedRouteId;
    
    // Hide all markers first
    Object.values(this.busMarkers).forEach(marker => {
      marker.getElement().style.display = 'none';
    });

    // Show only selected route markers
    if (selectedRouteId === '') {
      // Show all markers
      this.busMarkers.forEach(marker => {
        marker.getElement().style.display = 'block';
      });
    } else {
      // Hide all markers first
      this.busMarkers.forEach(marker => {
        marker.getElement().style.display = 'none';
      });
      
    }

    // Hide/show route lines
    this.routes.forEach(route => {
      const visibility = (selectedRouteId === '' || route.id === selectedRouteId) ? 'visible' : 'none';
      this.map!.setLayoutProperty(`route-${route.id}`, 'visibility', visibility);
    });
  }

  centerOnBus(busId: string) {
    // Bus tracking removed - user doesn't want bus functionality
  }

  refreshBusLocations() {
    // Real-time bus location updates are handled by CommuterService
    // This method is now handled by the subscription to activeBuses$
    console.log('Bus locations refreshed via real-time service');
  }

  getRouteColor(routeId: string): string {
    const colors = ['#FF5722', '#2196F3', '#4CAF50', '#FF9800', '#9C27B0'];
    const hash = routeId.split('').reduce((a, b) => {
      a = ((a << 5) - a) + b.charCodeAt(0);
      return a & a;
    }, 0);
    return colors[Math.abs(hash) % colors.length];
  }

  getRouteName(routeId: string): string {
    const route = this.routes.find(r => r.id === routeId);
    return route?.name || 'Unknown Route';
  }

  updateMapRoutes() {
    if (!this.map) return;

    // For now, since LiveRoute doesn't have coordinates, 
    // we'll use temporary route display until API provides coordinates
    // This will be enhanced once the API provides route coordinates
    console.log('Routes updated:', this.routes);
  }

  updateBusMarkers() {
    if (!this.map) return;

    // Remove existing bus markers
    Object.values(this.busMarkers).forEach(marker => marker.remove());
    this.busMarkers = [];

    // Bus tracking removed - user doesn't want bus functionality
  }

  addSingleBusMarker(bus: any) {
    if (!this.map) return;

    // Create popup with bus information
    const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
      <div class="bus-popup">
        <h4>🚌 ${bus.licensePlate}</h4>
        <p><strong>Driver:</strong> ${bus.driverName}</p>
        <p><strong>Route:</strong> ${this.getRouteName(bus.routeId)}</p>
        <p><strong>Status:</strong> ${bus.status}</p>
        <p><strong>ETA:</strong> ${bus.estimatedArrival}</p>
      </div>
    `);

    // Use Mapbox built-in marker for consistency and to avoid zoom/pan issues
    // Use route color or default orange for buses
    const busColor = this.getRouteColor(bus.routeId);
    const marker = new mapboxgl.Marker({ 
      color: busColor,
      scale: 1.1 
    })
      .setLngLat([bus.currentLocation.lng, bus.currentLocation.lat])
      .setPopup(popup)
      .addTo(this.map);

    this.busMarkers.push(marker);
  }

  addCommuterLocationMarker() {
    // This method is no longer needed - Mapbox GeolocateControl handles location display
    // The GeolocateControl shows a blue pulsing dot that tracks the user's location in real-time
    // Kept for backwards compatibility but can be removed
    if (!this.map || !this.commuterLocation) return;
  }

  ngOnDestroy() {
    this.stopLiveBusPoll();
    if (this.map) {
      this.map.remove();
    }
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }
}