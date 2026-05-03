import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { environment } from '../../environments/environment';

// Helper to parse stored DB coordinate values which may be JSON string, comma-separated string, or array
function parseStoredCoord(value: any): [number, number] | null {
  if (value == null) return null;
  try {
    // If it's a JSON string like '[123.45, 10.3]'
    if (typeof value === 'string') {
      const trimmed = value.trim();
      // Try JSON parse
      if (trimmed.startsWith('[')) {
        const arr = JSON.parse(trimmed);
        if (Array.isArray(arr) && arr.length >= 2) return [Number(arr[0]), Number(arr[1])];
      }
      // Try comma-separated 'lng,lat' or 'lat,lng'
      if (trimmed.indexOf(',') !== -1) {
        const parts = trimmed.split(',').map(p => p.trim());
        if (parts.length >= 2) return [Number(parts[0]), Number(parts[1])];
      }
      // otherwise can't parse
      return null;
    }
    // If it's already an array
    if (Array.isArray(value) && value.length >= 2) {
      return [Number(value[0]), Number(value[1])];
    }
    return null;
  } catch (e) {
    return null;
  }
}

export interface LiveRoute {
  id: string;
  scheduleId?: number; // NEW: Track which schedule this route belongs to
  name: string;
  basefare: number;
  pricePerKm: number;
  geometry: any;
  distance_km?: number; // Route distance in kilometers
  // optional exact stored start/end coordinates (normalized to [lng, lat])
  startCoord?: [number, number] | null;
  endCoord?: [number, number] | null;
  // NEW: Driver and bus info
  driverName?: string;
  busPlateNumber?: string;
  startedAt?: string; // When driver started the trip
  /** Terminal-manager stops (approved route package) */
  stops?: Array<{ name?: string; lng: number; lat: number; order?: number; distance_km_from_start?: number }>;
  approval_request_id?: number;
  bus_type?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CommuterService {
  private apiUrl = environment.apiUrl;
  
  // Real-time data streams
  private routesSubject = new BehaviorSubject<LiveRoute[]>([]);
  private busType: 'regular' | 'aircon' = (environment as any).commuterBusTypeDefault || 'regular';
  private terminal: string = (environment as any).commuterTerminal || 'north';
  
  public routes$ = this.routesSubject.asObservable();

  constructor(private http: HttpClient) {
    this.initializeRealTimeData();
  }

  setBusType(type: 'regular' | 'aircon'): void {
    this.busType = type;
    this.loadActiveRoutes();
  }

  setTerminal(term: 'north' | 'south'): void {
    this.terminal = term;
    this.loadActiveRoutes();
  }

  getBusType(): 'regular' | 'aircon' {
    return this.busType;
  }

  private initializeRealTimeData() {
    // Start polling for real-time updates
    setInterval(() => {
      this.refreshLiveData();
    }, 30000); // Update every 30 seconds
    
    // Initial load
    this.refreshLiveData();
  }

  private refreshLiveData() {
    this.loadActiveRoutes();
    // Removed bus loading since we only need routes for commuters
  }

  /** Distance-based fare for a specific stop on an approved route */
  previewFareAtStop(routeId: string, stopIndex: number, approvalRequestId?: number): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    });
    const body: any = {
      route_id: parseInt(routeId, 10),
      bus_type: this.busType,
      stop_index: stopIndex,
    };
    if (approvalRequestId != null) {
      body.approval_request_id = approvalRequestId;
    }
    return this.http.post<any>(`${this.apiUrl}/commuter/fare-preview`, body, { headers });
  }

  // Get all available routes with current schedules
  loadActiveRoutes(): void {
    const headers = new HttpHeaders({
      'ngrok-skip-browser-warning': 'true'
    });

    const approvedUrl = `${this.apiUrl}/commuter/approved-routes?terminal=${encodeURIComponent(this.terminal)}&bus_type=${encodeURIComponent(this.busType)}`;
    console.log('Loading approved routes from:', approvedUrl);
    this.http.get<any>(approvedUrl, { headers }).subscribe({
      next: (response: any) => {
        const routesArray = response.routes || [];
        if (routesArray.length > 0) {
          const liveRoutes: LiveRoute[] = routesArray.map((route: any) => {
            let geometry = route.geometry;
            if (typeof geometry === 'string') {
              try {
                geometry = JSON.parse(geometry);
              } catch (e) {
                geometry = null;
              }
            }
            const base =
              this.busType === 'aircon'
                ? parseFloat(route.aircon_price) || 0
                : parseFloat(route.regular_price) || 0;
            return {
              id: String(route.route_id),
              name: route.name,
              basefare: base,
              geometry,
              distance_km: route.distance_km ?? null,
              startCoord: null,
              endCoord: null,
              stops: route.stops || [],
              approval_request_id: route.approval_request_id,
              bus_type: route.bus_type,
            };
          });
          this.routesSubject.next(liveRoutes);
          console.log('✅ Approved routes with stops:', liveRoutes.length);
          return;
        }
        this.loadLegacyRoutes(headers);
      },
      error: () => {
        const headers = new HttpHeaders({ 'ngrok-skip-browser-warning': 'true' });
        this.loadLegacyRoutes(headers);
      },
    });
  }

  private loadLegacyRoutes(headers: HttpHeaders): void {
    console.log('Fallback: Loading routes from:', `${this.apiUrl}/routes`);
    this.http.get<any>(`${this.apiUrl}/routes`, { headers }).subscribe({
      next: (response: any) => {
        const routesArray = response.routes || [];
        const liveRoutes: LiveRoute[] = routesArray
          .filter((route: any) => !this.busType || (route.bus_type || 'regular') === this.busType)
          .map((route: any) => {
            let geometry = route.geometry;
            if (typeof geometry === 'string') {
              try {
                geometry = JSON.parse(geometry);
              } catch (e) {
                geometry = null;
              }
            }
            return {
              id: route.id.toString(),
              name: route.name,
              basefare:
                this.busType === 'aircon'
                  ? parseFloat(route.aircon_price) || parseFloat(route.regular_price)
                  : parseFloat(route.regular_price),
              geometry: geometry,
              distance_km: route.distance_km || null,
              startCoord: parseStoredCoord(route.start_coordinates ?? route.start_coordinate),
              endCoord: parseStoredCoord(route.end_coordinates ?? route.end_coordinate),
              stops: [],
            };
          });
        this.routesSubject.next(liveRoutes);
        console.log('✅ Legacy routes:', liveRoutes.length);
      },
      error: (error) => {
        console.error('Error loading routes:', error);
        this.routesSubject.next([]);
      },
    });
  }

  // Utility methods
  getCurrentRoutes(): LiveRoute[] {
    return this.routesSubject.value;
  }

  // Get specific route by ID
  getRouteById(routeId: string): LiveRoute | null {
    return this.getCurrentRoutes().find(route => route.id === routeId) || null;
  }

  // Fetch route details (including geometry) from API for a specific route
  getRouteDetails(routeId: string): Observable<any> {
    const headers = new HttpHeaders({ 'ngrok-skip-browser-warning': 'true' });
    return this.http.get<any>(`${this.apiUrl}/routes/${routeId}`, { headers });
  }

  /**
   * Calculate fare with passenger type discount via backend API
   * According to Philippine law (RA 9994), Students, Seniors (60+), and PWD get 20% discount
   * @param routeId - The route ID
   * @param passengerType - 'Regular', 'Student', 'Senior', or 'PWD'
   * @returns Observable with fare calculation result
   */
  calculateFareWithDiscount(routeId: string, passengerType: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true'
    });

    const body = {
      route_id: routeId,
      passenger_type: passengerType
    };

    // Backend route is /api/v1/fare/calculate
    return this.http.post<any>(`${this.apiUrl}/v1/fare/calculate`, body, { headers });
  }

  /**
   * Get passenger type from user profile
   */
  getPassengerType(): string {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        // Handle both camelCase (frontend) and snake_case (backend response)
        return parsed.passengerType || parsed.passenger_type || 'Regular';
      } catch (e) {
        return 'Regular';
      }
    }
    return 'Regular';
  }
}