import { Injectable } from '@angular/core';
import { environment } from '../../environments/environment';
import { Observable, BehaviorSubject } from 'rxjs';
import mapboxgl from 'mapbox-gl';

export interface MapboxRoute {
  id: string;
  name: string;
  coordinates: number[][];
  distance: number;
  duration: number;
  congestion?: string[]; // Traffic congestion levels for each coordinate segment
}

export interface GpsPosition {
  latitude: number;
  longitude: number;
  accuracy: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface BusRoute {
  id: string;
  name: string;
  operator: string;
  fare: number;
  currency: string;
  estimatedDuration: number; // in minutes
  frequency: string; // e.g., "Every 15 minutes"
  startTime: string; // e.g., "05:00 AM"
  endTime: string; // e.g., "10:00 PM"
  origin: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
  };
  destination: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
  };
  stops: {
    name: string;
    coordinates: [number, number]; // [lng, lat]
    isTimepoint?: boolean; // Whether this stop has a fixed arrival time
  }[];
}

export interface ActiveBusInfo {
  routeId: string;
  busId: string;
  plateNumber: string;
  capacity: number;
  occupancy: number;
  coordinates: [number, number]; // Current [lng, lat]
  heading: number; // Degrees from north
  speed: number; // km/h
  lastUpdated: Date;
  nextStop: string;
  status: 'on-time' | 'delayed' | 'ahead-of-schedule';
  delayMinutes?: number;
}

@Injectable({
  providedIn: 'root'
})
export class MapService {
  private mapboxToken = environment.mapbox.accessToken;

  private currentRouteSubject = new BehaviorSubject<MapboxRoute | null>(null);
  currentRoute$ = this.currentRouteSubject.asObservable();
  
  private currentPositionSubject = new BehaviorSubject<GpsPosition | null>(null);
  currentPosition$ = this.currentPositionSubject.asObservable();
  
  private watchId: number | null = null;
  private trackingEnabled = false;

  // Cebu, Philippines coordinates and bounds
  readonly CEBU_CENTER: [number, number] = [123.8854, 10.3157]; // [longitude, latitude]
  readonly CEBU_BOUNDS: [[number, number], [number, number]] = [
    [123.5000, 9.9000], // Southwest coordinates [lng, lat]
    [124.2000, 10.7000]  // Northeast coordinates [lng, lat]
  ];

  /**
   * Map styles specifically curated for Cebu
   */
  readonly CEBU_MAP_STYLES = {
    streets: 'mapbox://styles/mapbox/streets-v11',
    satellite: 'mapbox://styles/mapbox/satellite-streets-v11',
    transit: 'mapbox://styles/mapbox/navigation-day-v1',
    light: 'mapbox://styles/mapbox/light-v10',
    dark: 'mapbox://styles/mapbox/dark-v10'
  };

  // Sample bus routes for Cebu (would come from an API in a real app)
  private cebuBusRoutes: BusRoute[] = [
    {
      id: "route-01",
      name: "Cebu City Loop",
      operator: "Cebu Transit Corp",
      fare: 15.00,
      currency: "PHP",
      estimatedDuration: 45,
      frequency: "Every 15 minutes",
      startTime: "05:00 AM",
      endTime: "10:00 PM",
      origin: {
        name: "Cebu South Bus Terminal",
        coordinates: [123.8904, 10.2932]
      },
      destination: {
        name: "Cebu South Bus Terminal",
        coordinates: [123.8904, 10.2932]
      },
      stops: [
        { name: "Cebu South Bus Terminal", coordinates: [123.8904, 10.2932], isTimepoint: true },
        { name: "Cebu City Hall", coordinates: [123.9017, 10.2931] },
        { name: "Fuente Osmeña Circle", coordinates: [123.8912, 10.3108], isTimepoint: true },
        { name: "Ayala Center Cebu", coordinates: [123.9054, 10.3187] },
        { name: "SM City Cebu", coordinates: [123.9154, 10.3115], isTimepoint: true },
        { name: "Cebu IT Park", coordinates: [123.9063, 10.3307] },
        { name: "University of San Carlos", coordinates: [123.9113, 10.3499], isTimepoint: true },
        { name: "Cebu South Bus Terminal", coordinates: [123.8904, 10.2932], isTimepoint: true }
      ]
    },
    {
      id: "route-02",
      name: "Mandaue Express",
      operator: "Metro Cebu Transit",
      fare: 20.00,
      currency: "PHP",
      estimatedDuration: 35,
      frequency: "Every 20 minutes",
      startTime: "05:30 AM",
      endTime: "09:30 PM",
      origin: {
        name: "SM City Cebu",
        coordinates: [123.9154, 10.3115]
      },
      destination: {
        name: "Parkmall Mandaue",
        coordinates: [123.9483, 10.3389]
      },
      stops: [
        { name: "SM City Cebu", coordinates: [123.9154, 10.3115], isTimepoint: true },
        { name: "Cebu Doctors' University", coordinates: [123.9196, 10.3217] },
        { name: "Cebu International Port", coordinates: [123.9237, 10.3278], isTimepoint: true },
        { name: "Mandaue City Hall", coordinates: [123.9402, 10.3325] },
        { name: "Parkmall Mandaue", coordinates: [123.9483, 10.3389], isTimepoint: true }
      ]
    },
    {
      id: "route-03",
      name: "Mactan Airport Shuttle",
      operator: "Cebu Airport Express",
      fare: 75.00,
      currency: "PHP",
      estimatedDuration: 40,
      frequency: "Every 30 minutes",
      startTime: "04:00 AM",
      endTime: "11:00 PM",
      origin: {
        name: "Ayala Center Cebu",
        coordinates: [123.9054, 10.3187]
      },
      destination: {
        name: "Mactan-Cebu International Airport",
        coordinates: [123.9784, 10.3144]
      },
      stops: [
        { name: "Ayala Center Cebu", coordinates: [123.9054, 10.3187], isTimepoint: true },
        { name: "SM City Cebu", coordinates: [123.9154, 10.3115] },
        { name: "Mandaue City Center", coordinates: [123.9354, 10.3315], isTimepoint: true },
        { name: "Marcelo Fernan Bridge", coordinates: [123.9584, 10.3216] },
        { name: "Mactan Shrine", coordinates: [123.9684, 10.3125], isTimepoint: true },
        { name: "Mactan-Cebu International Airport", coordinates: [123.9784, 10.3144], isTimepoint: true }
      ]
    }
  ];
  
  private activeBusesSubject = new BehaviorSubject<ActiveBusInfo[]>([]);
  activeBuses$ = this.activeBusesSubject.asObservable();
  
  private selectedRouteSubject = new BehaviorSubject<BusRoute | null>(null);
  selectedRoute$ = this.selectedRouteSubject.asObservable();

  constructor() { 
    console.log('MapService initialized with token:', this.mapboxToken.substring(0, 8) + '...');
    // Set token for Mapbox GL
    (mapboxgl as any).accessToken = this.mapboxToken;
    
    // Start bus simulation
    this.startBusSimulation();
  }

  /**
   * Get directions between two points using Mapbox Directions API
   * @param origin Starting coordinates [lng, lat]
   * @param destination Destination coordinates [lng, lat]
   * @returns Promise with route information
   */
  async getDirections(origin: [number, number], destination: [number, number]): Promise<MapboxRoute> {
    try {
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${origin[0]},${origin[1]};${destination[0]},${destination[1]}?geometries=geojson&access_token=${this.mapboxToken}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        const result: MapboxRoute = {
          id: `route-${Date.now()}`,
          name: 'Direct Route',
          coordinates: route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]), // Convert to [lat, lng]
          distance: route.distance,
          duration: route.duration
        };
        
        this.currentRouteSubject.next(result);
        return result;
      } else {
        throw new Error('No routes found');
      }
    } catch (error) {
      console.error('Error fetching directions:', error);
      throw error;
    }
  }

  /**
   * Get directions with waypoints using Mapbox Directions API
   * @param waypoints Array of waypoint coordinates [[lng, lat], [lng, lat], ...]
   * @returns Promise with route information
   */
  async getRouteWithWaypoints(waypoints: [number, number][]): Promise<MapboxRoute> {
    try {
      if (waypoints.length < 2) {
        throw new Error('At least 2 waypoints are required');
      }
      
      const waypointsString = waypoints.map(wp => `${wp[0]},${wp[1]}`).join(';');
      const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypointsString}?geometries=geojson&annotations=congestion,duration,distance&overview=full&access_token=${this.mapboxToken}`;
      
      const response = await fetch(url);
      const data = await response.json();
      
      if (data.routes && data.routes.length > 0) {
        const route = data.routes[0];
        
        // Extract congestion data if available
        let congestion: string[] | undefined;
        if (route.legs && route.legs.length > 0 && route.legs[0].annotation && route.legs[0].annotation.congestion) {
          congestion = route.legs[0].annotation.congestion;
        }
        
        const result: MapboxRoute = {
          id: `route-${Date.now()}`,
          name: 'Transit Route',
          coordinates: route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]), // Convert to [lat, lng]
          distance: route.distance,
          duration: route.duration,
          congestion: congestion
        };
        
        this.currentRouteSubject.next(result);
        return result;
      } else {
        throw new Error('No routes found');
      }
    } catch (error) {
      console.error('Error fetching route with waypoints:', error);
      throw error;
    }
  }

  /**
   * Convert distance from meters to miles
   * @param meters Distance in meters
   * @returns Distance in miles
   */
  metersToMiles(meters: number): number {
    return meters / 1609.34;
  }

  /**
   * Convert seconds to minutes or hours:minutes format
   * @param seconds Duration in seconds
   * @returns Formatted duration string
   */
  formatDuration(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return `${hours}h ${remainingMinutes}m`;
    }
  }

  /**
   * Start GPS tracking using browser's geolocation API
   * @param highAccuracy Whether to use high accuracy mode (uses more battery)
   * @returns Observable of the current position
   */
  startGpsTracking(highAccuracy = true): Observable<GpsPosition | null> {
    if (!this.trackingEnabled && navigator.geolocation) {
      this.trackingEnabled = true;
      
      // Get initial position
      navigator.geolocation.getCurrentPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handlePositionError(error),
        { enableHighAccuracy: highAccuracy }
      );
      
      // Start watching position
      this.watchId = navigator.geolocation.watchPosition(
        (position) => this.handlePositionUpdate(position),
        (error) => this.handlePositionError(error),
        { 
          enableHighAccuracy: highAccuracy,
          maximumAge: 10000,      // Accept positions up to 10 seconds old
          timeout: 10000          // Wait up to 10 seconds for a position
        }
      );
      
      console.log('GPS tracking started');
    } else if (!navigator.geolocation) {
      console.error('Geolocation is not supported by this browser');
      this.currentPositionSubject.next(null);
    }
    
    return this.currentPosition$;
  }
  
  /**
   * Stop GPS tracking
   */
  stopGpsTracking(): void {
    if (this.trackingEnabled && this.watchId !== null && navigator.geolocation) {
      navigator.geolocation.clearWatch(this.watchId);
      this.watchId = null;
      this.trackingEnabled = false;
      console.log('GPS tracking stopped');
    }
  }
  
  /**
   * Check if GPS tracking is currently active
   * @returns Whether GPS tracking is active
   */
  isTrackingEnabled(): boolean {
    return this.trackingEnabled;
  }
  
  /**
   * Get the last known position
   * @returns The last known position or null
   */
  getLastPosition(): GpsPosition | null {
    return this.currentPositionSubject.value;
  }
  
  /**
   * Handle position updates from the geolocation API
   * @param position The position object from the geolocation API
   */
  private handlePositionUpdate(position: GeolocationPosition): void {
    const gpsPosition: GpsPosition = {
      latitude: position.coords.latitude,
      longitude: position.coords.longitude,
      accuracy: position.coords.accuracy,
      heading: position.coords.heading || undefined,
      speed: position.coords.speed || undefined,
      timestamp: position.timestamp
    };
    
    this.currentPositionSubject.next(gpsPosition);
  }
  
  /**
   * Handle errors from the geolocation API
   * @param error The error object from the geolocation API
   */
  private handlePositionError(error: GeolocationPositionError): void {
    let errorMessage: string;
    
    switch (error.code) {
      case error.PERMISSION_DENIED:
        errorMessage = 'User denied the request for geolocation';
        break;
      case error.POSITION_UNAVAILABLE:
        errorMessage = 'Location information is unavailable';
        break;
      case error.TIMEOUT:
        errorMessage = 'The request to get user location timed out';
        break;
      default:
        errorMessage = 'An unknown error occurred';
        break;
    }
    
    console.error('Geolocation error:', errorMessage);
    // Don't set position to null - keep the last known position
  }
  
  /**
   * Calculate the distance between two coordinates in meters
   * @param lat1 Latitude of first point
   * @param lon1 Longitude of first point
   * @param lat2 Latitude of second point
   * @param lon2 Longitude of second point
   * @returns Distance in meters
   */
  calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;
    
    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    
    return R * c;
  }
  
  /**
   * Get map configuration for Cebu, Philippines
   * @param container The HTML element ID of the container where the map will be rendered
   * @param restrictBounds Whether to restrict the map to Cebu bounds
   * @returns Mapbox GL map configuration
   */
  getCebuMapConfig(container: string, restrictBounds = true): mapboxgl.MapboxOptions {
    return {
      container,
      style: this.CEBU_MAP_STYLES.transit, // Use transit-focused style by default
      center: this.CEBU_CENTER,
      zoom: 11, // Adjust zoom level as needed
      maxZoom: 18,
      minZoom: 9,
      maxBounds: restrictBounds ? this.CEBU_BOUNDS : undefined,
      attributionControl: true,
      localIdeographFontFamily: "'Noto Sans', 'Noto Sans CJK SC', sans-serif"
    };
  }
  
  /**
   * Create a map focused on Cebu, Philippines
   * @param container The HTML element ID of the container where the map will be rendered
   * @param restrictBounds Whether to restrict the map to Cebu bounds
   * @returns A new Mapbox GL map instance
   */
  createCebuMap(container: string, restrictBounds = true): mapboxgl.Map {
    const map = new mapboxgl.Map(this.getCebuMapConfig(container, restrictBounds));
    
    // Add a scale control
    map.addControl(new mapboxgl.ScaleControl({
      maxWidth: 100,
      unit: 'metric'
    }), 'bottom-left');
    
    return map;
  }
  
  /**
   * Change the map style while preserving the camera position
   * @param map The Mapbox GL map instance
   * @param styleKey The key of the style to apply (from CEBU_MAP_STYLES)
   */
  changeCebuMapStyle(map: mapboxgl.Map, styleKey: keyof typeof this.CEBU_MAP_STYLES): void {
    const style = this.CEBU_MAP_STYLES[styleKey];
    
    // Store the current camera position
    const center = map.getCenter();
    const zoom = map.getZoom();
    const bearing = map.getBearing();
    const pitch = map.getPitch();
    
    // Apply the new style
    map.setStyle(style);
    
    // After the style loads, restore the camera position
    map.once('style.load', () => {
      map.setCenter(center);
      map.setZoom(zoom);
      map.setBearing(bearing);
      map.setPitch(pitch);
    });
  }
  
  /**
   * Create a route between two points in Cebu
   * @param origin Starting point coordinates [lat, lng]
   * @param destination Ending point coordinates [lat, lng]
   * @param map Optional map instance to display the route on
   * @returns Promise with route information
   */
  async createCebuRoute(
    origin: [number, number], 
    destination: [number, number],
    map?: mapboxgl.Map
  ): Promise<MapboxRoute> {
    // Convert coordinates from [lat, lng] to [lng, lat] for Mapbox API
    const originLngLat: [number, number] = [origin[1], origin[0]];
    const destinationLngLat: [number, number] = [destination[1], destination[0]];
    
    try {
      // Get the route using the existing getDirections method
      const route = await this.getDirections(originLngLat, destinationLngLat);
      
      // If map is provided, display an A-B route marker and line
      if (map) {
        this.displayOriginDestinationRoute(map, origin, destination, route);
      }
      
      return route;
    } catch (error) {
      console.error('Error creating Cebu route:', error);
      throw error;
    }
  }
  
  /**
   * Display origin-destination markers and route line on the map
   * @param map The map instance
   * @param origin Origin coordinates [lat, lng]
   * @param destination Destination coordinates [lat, lng]
   * @param route Route information
   */
  displayOriginDestinationRoute(
    map: mapboxgl.Map, 
    origin: [number, number], 
    destination: [number, number],
    route: MapboxRoute
  ): void {
    // Clear existing route markers and lines
    this.clearRouteDisplay(map);
    
    // Add origin marker (A)
    const originEl = document.createElement('div');
    originEl.className = 'origin-marker';
    originEl.innerHTML = '<strong>A</strong>';
    
    new mapboxgl.Marker({
      element: originEl,
      color: '#00b0ff'
    })
    .setLngLat([origin[1], origin[0]])
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Origin</strong>'))
    .addTo(map);
    
    // Add destination marker (B)
    const destEl = document.createElement('div');
    destEl.className = 'destination-marker';
    destEl.innerHTML = '<strong>B</strong>';
    
    new mapboxgl.Marker({
      element: destEl,
      color: '#ff4081'
    })
    .setLngLat([destination[1], destination[0]])
    .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML('<strong>Destination</strong>'))
    .addTo(map);
    
    // Add route line to map
    if (!map.getSource('route-ab')) {
      map.addSource('route-ab', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: []
          }
        }
      });
      
      map.addLayer({
        id: 'route-ab-casing',
        type: 'line',
        source: 'route-ab',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#2d5f99',
          'line-width': 8,
          'line-opacity': 0.6
        }
      });
      
      map.addLayer({
        id: 'route-ab',
        type: 'line',
        source: 'route-ab',
        layout: {
          'line-join': 'round',
          'line-cap': 'round'
        },
        paint: {
          'line-color': '#0088ff',
          'line-width': 5,
          'line-opacity': 0.8
        }
      });
    }
    
    // Convert coordinates from [lat, lng] to [lng, lat] for Mapbox
    const coordinates = route.coordinates.map(coord => [coord[1], coord[0]]);
    
    // Update route line with new coordinates
    (map.getSource('route-ab') as mapboxgl.GeoJSONSource).setData({
      type: 'Feature' as const,
      properties: {},
      geometry: {
        type: 'LineString' as const,
        coordinates
      }
    });
    
    // Fit map to show the entire route
    this.fitMapToCoordinates(map, coordinates);
    
    // Display route info (distance and duration)
    this.displayRouteInfo(map, route);
  }
  
  /**
   * Clear route display from map
   * @param map The map instance
   */
  clearRouteDisplay(map: mapboxgl.Map): void {
    // Remove all markers except user location
    const markers = document.querySelectorAll('.mapboxgl-marker:not(.user-location-marker):not(.user-location-radius)');
    markers.forEach(marker => {
      marker.remove();
    });
    
    // If route source exists, clear it
    if (map.getSource('route-ab')) {
      (map.getSource('route-ab') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature' as const,
        properties: {},
        geometry: {
          type: 'LineString' as const,
          coordinates: []
        }
      });
    }
    
    // Remove route info display if it exists
    const routeInfo = document.querySelector('.route-info-overlay');
    if (routeInfo) {
      routeInfo.remove();
    }
  }
  
  /**
   * Fit map to show all coordinates
   * @param map The map instance
   * @param coordinates Array of [lng, lat] coordinates
   */
  fitMapToCoordinates(map: mapboxgl.Map, coordinates: number[][]): void {
    if (coordinates.length === 0) return;
    
    const bounds = coordinates.reduce((bounds, coord) => {
      return bounds.extend(coord as [number, number]);
    }, new mapboxgl.LngLatBounds(coordinates[0] as [number, number], coordinates[0] as [number, number]));
    
    map.fitBounds(bounds, {
      padding: { top: 100, bottom: 100, left: 50, right: 50 },
      duration: 1000
    });
  }
  
  /**
   * Display route information overlay
   * @param map The map instance
   * @param route Route information
   */
  displayRouteInfo(map: mapboxgl.Map, route: MapboxRoute): void {
    // Remove existing route info if any
    const existingInfo = document.querySelector('.route-info-overlay');
    if (existingInfo) {
      existingInfo.remove();
    }
    
    // Create route info container
    const container = document.createElement('div');
    container.className = 'route-info-overlay';
    
    // Format distance and duration
    const distance = this.metersToKilometers(route.distance);
    const duration = this.formatDuration(route.duration);
    
    // Create content
    container.innerHTML = `
      <div class="route-info-card">
        <div class="route-info-header">
          <h3>Route Information</h3>
        </div>
        <div class="route-info-body">
          <div class="route-info-item">
            <ion-icon name="navigate-outline"></ion-icon>
            <span>${distance} km</span>
          </div>
          <div class="route-info-item">
            <ion-icon name="time-outline"></ion-icon>
            <span>${duration}</span>
          </div>
        </div>
      </div>
    `;
    
    // Add to map container
    map.getContainer().appendChild(container);
  }
  
  /**
   * Convert meters to kilometers with 1 decimal place
   * @param meters Distance in meters
   * @returns Formatted distance in kilometers
   */
  metersToKilometers(meters: number): string {
    return (meters / 1000).toFixed(1);
  }

  /**
   * Get all available bus routes
   * @returns Array of bus routes
   */
  getBusRoutes(): BusRoute[] {
    return [...this.cebuBusRoutes];
  }
  
  /**
   * Get a specific bus route by ID
   * @param routeId The ID of the route to get
   * @returns The bus route or null if not found
   */
  getBusRouteById(routeId: string): BusRoute | null {
    return this.cebuBusRoutes.find(route => route.id === routeId) || null;
  }
  
  /**
   * Select a bus route to display
   * @param routeId The ID of the route to select
   */
  selectBusRoute(routeId: string): void {
    const route = this.getBusRouteById(routeId);
    this.selectedRouteSubject.next(route);
    
    if (route) {
      // Generate and store the route in Mapbox format
      this.generateBusRoute(route)
        .then(mapboxRoute => this.currentRouteSubject.next(mapboxRoute))
        .catch(error => console.error('Error generating bus route:', error));
    }
  }
  
  /**
   * Generate a Mapbox route from a bus route
   * @param busRoute The bus route to generate
   * @returns Promise with Mapbox route
   */
  async generateBusRoute(busRoute: BusRoute): Promise<MapboxRoute> {
    try {
      // Extract all waypoints from the bus route
      const waypoints = busRoute.stops.map(stop => stop.coordinates);
      
      // If waypoints has at least 2 points, get directions
      if (waypoints.length >= 2) {
        const waypointsString = waypoints.map(wp => `${wp[0]},${wp[1]}`).join(';');
        const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${waypointsString}?geometries=geojson&annotations=congestion,duration,distance&overview=full&access_token=${this.mapboxToken}`;
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.routes && data.routes.length > 0) {
          const route = data.routes[0];
          
          // Extract congestion data if available
          let congestion: string[] | undefined;
          if (route.legs && route.legs.length > 0 && route.legs[0].annotation && route.legs[0].annotation.congestion) {
            congestion = route.legs[0].annotation.congestion;
          }
          
          return {
            id: busRoute.id,
            name: busRoute.name,
            coordinates: route.geometry.coordinates.map((coord: number[]) => [coord[1], coord[0]]), // Convert to [lat, lng]
            distance: route.distance,
            duration: route.duration,
            congestion: congestion
          };
        }
      }
      
      // Fallback: create a simple route connecting the stops
      return this.createSimpleRoute(busRoute);
    } catch (error) {
      console.error('Error generating bus route:', error);
      // Fallback to a simple route
      return this.createSimpleRoute(busRoute);
    }
  }
  
  /**
   * Create a simple route by connecting the stops directly
   * @param busRoute The bus route
   * @returns A simple Mapbox route
   */
  private createSimpleRoute(busRoute: BusRoute): MapboxRoute {
    // Convert stop coordinates from [lng, lat] to [lat, lng]
    const coordinates = busRoute.stops.map(stop => [stop.coordinates[1], stop.coordinates[0]]);
    
    // Estimate distance and duration
    let totalDistance = 0;
    for (let i = 1; i < coordinates.length; i++) {
      totalDistance += this.calculateDistance(
        coordinates[i-1][0], coordinates[i-1][1],
        coordinates[i][0], coordinates[i][1]
      );
    }
    
    // Estimate duration (assuming average speed of 20 km/h in urban areas)
    const averageSpeedMetersPerSecond = (20 * 1000) / 3600; // 20 km/h in m/s
    const estimatedDuration = totalDistance / averageSpeedMetersPerSecond;
    
    return {
      id: busRoute.id,
      name: busRoute.name,
      coordinates: coordinates,
      distance: totalDistance,
      duration: estimatedDuration
    };
  }
  
  /**
   * Get all active buses for a specific route
   * @param routeId The ID of the route
   * @returns Array of active buses on the route
   */
  getActiveBusesForRoute(routeId: string): ActiveBusInfo[] {
    return this.activeBusesSubject.value.filter(bus => bus.routeId === routeId);
  }
  
  /**
   * In a real app, this would come from an API or websocket
   * For the mock app, we'll simulate buses moving along routes
   */
  startBusSimulation(): void {
    // Create some mock active buses for each route
    const mockBuses: ActiveBusInfo[] = [];
    
    this.cebuBusRoutes.forEach(route => {
      // Add 2-3 buses per route at different positions
      const numBuses = 2 + Math.floor(Math.random() * 2);
      
      for (let i = 0; i < numBuses; i++) {
        // Place bus at a random stop
        const stopIndex = Math.floor(Math.random() * (route.stops.length - 1));
        const nextStopIndex = stopIndex + 1;
        
        mockBuses.push({
          routeId: route.id,
          busId: `${route.id}-bus-${i+1}`,
          plateNumber: `CBC ${1000 + Math.floor(Math.random() * 9000)}`,
          capacity: 50,
          occupancy: 10 + Math.floor(Math.random() * 30),
          coordinates: route.stops[stopIndex].coordinates,
          heading: 0, // Will be calculated
          speed: 15 + Math.floor(Math.random() * 20),
          lastUpdated: new Date(),
          nextStop: route.stops[nextStopIndex].name,
          status: Math.random() > 0.7 ? 'delayed' : 'on-time',
          delayMinutes: Math.random() > 0.7 ? Math.floor(Math.random() * 10) + 1 : undefined
        });
      }
    });
    
    this.activeBusesSubject.next(mockBuses);
    
    // Start updating bus positions every few seconds
    setInterval(() => this.updateBusPositions(), 3000);
  }
  
  /**
   * Update positions of active buses (simulation)
   */
  private updateBusPositions(): void {
    const buses = [...this.activeBusesSubject.value];
    
    buses.forEach(bus => {
      const route = this.getBusRouteById(bus.routeId);
      if (!route) return;
      
      // Find current stop index
      const currentStopIndex = route.stops.findIndex(stop => 
        stop.coordinates[0] === bus.coordinates[0] && 
        stop.coordinates[1] === bus.coordinates[1]
      );
      
      if (currentStopIndex !== -1) {
        // Bus is at a stop, move it toward the next stop
        const nextStopIndex = (currentStopIndex + 1) % route.stops.length;
        const nextStop = route.stops[nextStopIndex];
        
        // Calculate heading
        const heading = this.calculateHeading(
          bus.coordinates[1], bus.coordinates[0], 
          nextStop.coordinates[1], nextStop.coordinates[0]
        );
        
        // Move bus partially toward next stop
        const progress = 0.2; // Move 20% of the way
        const newLng = bus.coordinates[0] + progress * (nextStop.coordinates[0] - bus.coordinates[0]);
        const newLat = bus.coordinates[1] + progress * (nextStop.coordinates[1] - bus.coordinates[1]);
        
        // Update bus
        bus.coordinates = [newLng, newLat];
        bus.heading = heading;
        bus.lastUpdated = new Date();
        bus.nextStop = nextStop.name;
        
        // Sometimes change status
        if (Math.random() < 0.1) {
          bus.status = Math.random() > 0.7 ? 'delayed' : 'on-time';
          bus.delayMinutes = bus.status === 'delayed' ? Math.floor(Math.random() * 10) + 1 : undefined;
        }
      }
    });
    
    this.activeBusesSubject.next(buses);
  }
  
  /**
   * Calculate heading angle between two points
   * @returns Heading in degrees from north
   */
  private calculateHeading(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;
    
    const y = Math.sin(Δλ) * Math.cos(φ2);
    const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
    
    const θ = Math.atan2(y, x);
    return (θ * 180 / Math.PI + 360) % 360; // in degrees, 0-360
  }
}
