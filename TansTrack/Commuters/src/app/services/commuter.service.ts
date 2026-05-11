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

/** Ensure map gets a GeoJSON LineString (unwrap Feature / parse string). */
function normalizeLineStringGeometry(raw: unknown): { type: 'LineString'; coordinates: number[][] } | null {
  let g: any = raw;
  if (g == null) return null;
  if (typeof g === 'string') {
    try {
      let p: any = g;
      let guard = 0;
      while (typeof p === 'string' && guard++ < 4) p = JSON.parse(p);
      g = p;
    } catch {
      return null;
    }
  }
  if (g?.type === 'Feature' && g.geometry) {
    g = g.geometry;
  }
  if (g?.type === 'LineString' && Array.isArray(g.coordinates) && g.coordinates.length >= 2) {
    return g;
  }
  return null;
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

export interface LiveBusTrip {
  schedule_id: number;
  status: string;
  bus_number: string;
  plate_number: string;
  bus_company: string;
  capacity: number;
  aboard: number;
  is_full: boolean;
  driver_name: string;
  operator_company: string;
  start_time: string | null;
  position: { lng: number; lat: number } | null;
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
            const line = normalizeLineStringGeometry(geometry);
            if (line) {
              geometry = line;
            }
            const base =
              this.busType === 'aircon'
                ? parseFloat(route.aircon_price) || 0
                : parseFloat(route.regular_price) || 0;
            return {
              id: String(route.route_id),
              scheduleId:
                route.schedule_id != null && route.schedule_id !== ''
                  ? Number(route.schedule_id)
                  : undefined,
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
            const line = normalizeLineStringGeometry(geometry);
            if (line) {
              geometry = line;
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
      passenger_type: passengerType,
      bus_type: this.busType,
    };

    return this.http.post<any>(`${this.apiUrl}/commuter/fare-calculate`, body, { headers });
  }

  /**
   * Get passenger type from user profile
   */
  getPassengerType(): string {
    const userData = sessionStorage.getItem('currentUser');
    if (userData) {
      try {
        const parsed = JSON.parse(userData);
        const stored = parsed.passengerType || parsed.passenger_type;
        if (stored && stored !== 'Regular') return stored;
        // Auto-detect Student from email domain if type not saved yet
        const domain = (parsed.email || '').split('@')[1]?.toLowerCase() || '';
        if (domain.endsWith('.edu.ph') || domain.endsWith('.edu')) return 'Student';
        return 'Regular';
      } catch (e) {
        return 'Regular';
      }
    }
    return 'Regular';
  }

  /**
   * Register e-ticket with the operator (trip logs + driver boarding list).
   */
  bookTicket(payload: {
    route_id: number;
    schedule_id?: number;
    public_ticket_id: string;
    fare: number;
    commuter_id?: number;
    payment_method?: string;
    from_stop_index?: number;
  }): Observable<{ success: boolean; message?: string; data?: { id: number; public_ticket_id: string; schedule_id: number } }> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
    return this.http.post<any>(`${this.apiUrl}/commuter/book-ticket`, payload, { headers });
  }

  getLiveBuses(
    routeId: string,
    terminal: 'north' | 'south'
  ): Observable<{ success: boolean; buses?: LiveBusTrip[]; message?: string; updated_at?: string }> {
    const headers = new HttpHeaders({ 'ngrok-skip-browser-warning': 'true' });
    const params = new URLSearchParams({
      route_id: String(routeId),
      terminal,
      bus_type: this.busType,
    });
    return this.http.get<any>(`${this.apiUrl}/commuter/live-buses?${params.toString()}`, { headers });
  }

  fareSegment(payload: {
    route_id: number;
    from_stop_index: number;
    to_stop_index: number;
    approval_request_id?: number;
  }): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
    const body = {
      route_id: payload.route_id,
      bus_type: this.busType,
      from_stop_index: payload.from_stop_index,
      to_stop_index: payload.to_stop_index,
      approval_request_id: payload.approval_request_id,
      passenger_type: this.getPassengerType(),
    };
    return this.http.post<any>(`${this.apiUrl}/commuter/fare-segment`, body, { headers });
  }

  /** Tell the backend the commuter has left the bus (aboard count drops; revenue unchanged). */
  alight(publicTicketId: string): Observable<{ success: boolean; message?: string }> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
    return this.http.post<any>(`${this.apiUrl}/commuter/alight`, { public_ticket_id: publicTicketId }, {
      headers,
    });
  }

  /** Register intent to board at a stop — creates a marker on the driver map before payment. */
  requestBoarding(payload: {
    schedule_id: number;
    route_id?: number;
    from_stop_index?: number;
    commuter_id?: number;
    commuter_name?: string | null;
    commuter_email?: string | null;
    terminal?: string;
    approval_request_id?: number;
  }): Observable<{ success: boolean; id?: number; boarding_stop_name?: string | null }> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
    return this.http.post<any>(`${this.apiUrl}/commuter/request-boarding`, payload, { headers });
  }

  /** Cancel a waiting boarding request. */
  cancelBoardingRequest(id: number): Observable<{ success: boolean }> {
    const headers = new HttpHeaders({ 'ngrok-skip-browser-warning': 'true' });
    return this.http.patch<any>(`${this.apiUrl}/commuter/boarding-requests/${id}/cancel`, {}, { headers });
  }

  /** Cancel ALL waiting boarding requests for this commuter (clears stale sessions on app init). */
  cancelMyBoardingRequests(identity: { commuter_id?: number; commuter_email?: string; commuter_name?: string }): Observable<{ success: boolean }> {
    const headers = new HttpHeaders({ 'ngrok-skip-browser-warning': 'true' });
    return this.http.post<any>(`${this.apiUrl}/commuter/cancel-my-boarding-requests`, identity, { headers });
  }

  /** Submit post-trip feedback for the driver (auto-resolves driver/schedule from ticket). */
  submitFeedback(payload: {
    commuter_id: number | null;
    public_ticket_id: string | null;
    schedule_id?: number | null;
    driver_rating: number;
    comment?: string | null;
  }): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
    return this.http.post<any>(`${this.apiUrl}/feedbacks`, payload, { headers });
  }

  /** Mark a ticket as paid after a successful e-wallet or card payment. */
  markTicketPaid(publicTicketId: string, paymentMethod: string): Observable<any> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      'ngrok-skip-browser-warning': 'true',
    });
    return this.http.patch(
      `${this.apiUrl}/commuter/tickets/${encodeURIComponent(publicTicketId)}/mark-paid`,
      { payment_method: paymentMethod },
      { headers }
    );
  }
}