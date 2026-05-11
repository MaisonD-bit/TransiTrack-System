import { Component, OnInit, OnDestroy, NgZone } from '@angular/core';
import { ViewWillEnter, ViewWillLeave } from '@ionic/angular';
import mapboxgl from 'mapbox-gl';
import { ScannedPayment } from '../components/qr-scanner/qr-scanner.component';
import { PaymentService, PaymentResult } from '../services/payment.service';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { CommuterService, LiveBusTrip, LiveRoute } from '../services/commuter.service';
import { BusSimulatorService } from '../services/bus-simulator.service';
import { TripHistoryService } from '../services/trip-history.service';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy, ViewWillEnter, ViewWillLeave {
  currentTime: string = '';

  // Real route data
  routes: LiveRoute[] = [];
  selectedRoute: LiveRoute | null = null;
  selectedRouteId: string = '';
  /** Terminal (north/south) — must match approved route packages */
  commuterTerminal: 'north' | 'south' = (environment as any).commuterTerminal || 'north';
  /** regular vs air-con — filters approved routes */
  busType: 'regular' | 'aircon' = (environment as any).commuterBusTypeDefault || 'regular';
  /** When terminal manager stops exist: user picks alighting point (single-stop / legacy) */
  stopChoice: string | number = 'terminus';
  /** Pathway: board at stop index (must be &lt; toStopIndex) */
  fromStopIndex = 0;
  toStopIndex = 0;
  liveBuses: LiveBusTrip[] = [];
  liveBusMapPins: {
    lng: number;
    lat: number;
    label: string;
    color: string;
    scheduleId?: number;
    selected?: boolean;
  }[] = [];
  selectedScheduleId: number | null = null;
  private liveBusPollTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptions: Subscription[] = [];
  // e-ticket state
  showTicket: boolean = false;
  paymentCompleted: boolean = false;
  ticketDestination: string | null = null;
  ticketFare: number | null = null;
  ticketId: string = '';
  paymentMethod: string = 'cash';
  discountPercent: number = 0;
  discountAmount: number = 0;
  /** Operator / bus labels for e-ticket QR (from selected live bus). */
  ticketOperatorCompany = '';
  ticketBusLabel = '';

  // Bus simulation for route visualization and distance tracking
  boardingLocation: { lng: number; lat: number } | null = null;
  currentBusPosition: { lng: number; lat: number } | null = null;
  distanceTraveled: number = 0; // Distance in kilometers from boarding point
  isSimulationActive: boolean = false;
  private busSimulationSubscription: Subscription | null = null;
  /** Avoid duplicate POST /commuter/alight for the same ride. */
  private alightNotified: boolean = false;
  /** Prevents re-triggering the stop arrival when bus lingers near the stop. */
  private alightStopReached: boolean = false;
  /** Pending payment waiting for Maya popup result. */
  private pendingMayaPayment: { payment: ScannedPayment; fare: number } | null = null;
  // Post-trip UI state
  showRatingModal: boolean = false;
  showTripComplete: boolean = false;
  completedTripInfo: { routeName: string; fare: number; driverName: string; scheduleId: number | null; ticketId: string; boardStopName?: string; alightStopName?: string } | null = null;
  selectedRating: number = 0;
  ratingComment: string = '';
  private mayaMessageHandler: ((e: MessageEvent) => void) | null = null;
  showQrScanner: boolean = false;
  showCardPayment: boolean = false;
  pendingPayment: { payment: ScannedPayment; method: any; fare: number } | null = null;
  boardingRequestId: number | null = null;
  boardingRequested: boolean = false;
  boardingRequestStopName: string = '';
  private boardingReqInFlight = false;
  private boardingReqPendingRetry = false;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    public commuterService: CommuterService,
    private busSimulator: BusSimulatorService,
    private tripHistoryService: TripHistoryService,
    private paymentService: PaymentService,
    private ngZone: NgZone
  ) {}

  private readonly TRIP_STATE_BASE_KEY = 'commuter_active_trip';

  private getTripStateKey(): string {
    try {
      const stored = sessionStorage.getItem('currentUser');
      const id = stored ? JSON.parse(stored)?.id : null;
      return id ? `${this.TRIP_STATE_BASE_KEY}_${id}` : this.TRIP_STATE_BASE_KEY;
    } catch {
      return this.TRIP_STATE_BASE_KEY;
    }
  }

  ngOnInit() {
    this.updateCurrentTime();
    setInterval(() => this.updateCurrentTime(), 60000);
    this.loadRouteData();
  }

  ionViewWillEnter() {
    this.restoreActiveTrip();
  }

  ionViewWillLeave() {
    this.saveActiveTrip();
  }

  private saveActiveTrip(): void {
    if (!this.selectedRouteId) {
      localStorage.removeItem(this.getTripStateKey());
      return;
    }
    localStorage.setItem(this.getTripStateKey(), JSON.stringify({
      selectedRouteId: this.selectedRouteId,
      ticketId: this.ticketId,
      ticketFare: this.ticketFare,
      showTicket: this.showTicket,
      paymentCompleted: this.paymentCompleted,
      selectedScheduleId: this.selectedScheduleId,
      toStopIndex: this.toStopIndex,
      fromStopIndex: this.fromStopIndex,
      ticketDestination: this.ticketDestination,
      discountPercent: this.discountPercent,
      discountAmount: this.discountAmount,
      ticketOperatorCompany: this.ticketOperatorCompany,
      ticketBusLabel: this.ticketBusLabel,
    }));
  }

  private restoreActiveTrip(): void {
    const raw = localStorage.getItem(this.getTripStateKey());
    if (!raw || !this.routes.length) {
      this.cancelStaleMyBoardingRequests();
      return;
    }
    try {
      const s = JSON.parse(raw);
      const route = this.routes.find(r => String(r.id) === String(s.selectedRouteId));
      if (!route) return;
      this.selectedRouteId = s.selectedRouteId;
      this.selectedRoute = route;
      this.ticketId = s.ticketId || '';
      this.ticketFare = s.ticketFare ?? null;
      this.showTicket = s.showTicket ?? false;
      this.paymentCompleted = s.paymentCompleted ?? false;
      this.selectedScheduleId = s.selectedScheduleId ?? null;
      this.toStopIndex = s.toStopIndex ?? 0;
      this.fromStopIndex = s.fromStopIndex ?? 0;
      this.ticketDestination = s.ticketDestination ?? null;
      this.discountPercent = s.discountPercent ?? 0;
      this.discountAmount = s.discountAmount ?? 0;
      this.ticketOperatorCompany = s.ticketOperatorCompany || '';
      this.ticketBusLabel = s.ticketBusLabel || '';
      this.syncStopPinsForMap();
      this.startLiveBusPoll();
    } catch {
      localStorage.removeItem(this.getTripStateKey());
    }
  }

  /**
   * Must be a stable array reference — a template getter that returned a new [] every CD
   * caused route-map ngOnChanges to fire endlessly and restart bus interpolation.
   */
  stopPinsForMap: { lng: number; lat: number; label?: string }[] = [];

  private syncStopPinsForMap(): void {
    const stops = this.selectedRoute?.stops;
    if (!stops?.length) {
      this.stopPinsForMap = [];
      return;
    }
    this.stopPinsForMap = stops
      .map((s: any, i: number) => ({
        lng: Number(s.lng),
        lat: Number(s.lat),
        label: s.name || `Stop ${i + 1}`,
      }))
      .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat));
  }

  /** GeoJSON from DB/API may be a Feature, string, or LineString — map expects LineString. */
  private normalizeLineStringGeometry(raw: unknown): { type: 'LineString'; coordinates: number[][] } | null {
    let g: any = raw;
    if (g == null) {
      return null;
    }
    if (typeof g === 'string') {
      try {
        let parsed: any = g;
        let guard = 0;
        while (typeof parsed === 'string' && guard < 4) {
          parsed = JSON.parse(parsed);
          guard++;
        }
        g = parsed;
      } catch {
        return null;
      }
    }
    if (g?.type === 'Feature' && g.geometry) {
      g = g.geometry;
    }
    if (
      g?.type === 'LineString' &&
      Array.isArray(g.coordinates) &&
      g.coordinates.length >= 2
    ) {
      return g;
    }
    return null;
  }

  onTerminalChange() {
    this.commuterService.setTerminal(this.commuterTerminal);
  }

  onBusTypeChange() {
    this.commuterService.setBusType(this.busType);
    this.selectedRouteId = '';
    this.selectedRoute = null;
    this.ticketFare = null;
    this.liveBuses = [];
    this.liveBusMapPins = [];
    this.selectedScheduleId = null;
    this.stopLiveBusPoll();
    this.syncStopPinsForMap();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopLiveBusPoll();
    this.stopBusSimulation();
    if (this.mayaMessageHandler) {
      window.removeEventListener('message', this.mayaMessageHandler);
    }
  }

  loadRouteData() {
    console.log('Home page: Loading route data...');
    // Subscribe to routes data
    const routesSub = this.commuterService.routes$.subscribe(routes => {
      this.routes = routes;
      // Only restore on initial load — skip if user has already selected a route
      if (!this.selectedRouteId) {
        this.restoreActiveTrip();
      }
    });
    
    this.subscriptions.push(routesSub);
  }
  async onRouteSelected() {
    if (!this.selectedRouteId) {
      this.selectedRoute = null;
      this.stopLiveBusPoll();
      this.liveBuses = [];
      this.liveBusMapPins = [];
      this.selectedScheduleId = null;
      this.ticketOperatorCompany = '';
      this.ticketBusLabel = '';
      this.discountAmount = 0;
      this.syncStopPinsForMap();
      return;
    }

    this.paymentCompleted = false;
    this.alightStopReached = false;
    this.alightNotified = false;
    this.resetBoardingRequest();
    // pick from cache (ion-select may use string or number id)
    const sid = String(this.selectedRouteId);
    this.selectedRoute = this.routes.find((route) => String(route.id) === sid) || null;
    console.log('Selected route:', this.selectedRoute);
    this.syncStopPinsForMap();

    if (!this.selectedRoute) return;

    const normalized = this.normalizeLineStringGeometry(this.selectedRoute.geometry);
    if (normalized) {
      this.selectedRoute.geometry = normalized;
    }

    this.stopChoice = 'terminus';
    this.selectedScheduleId = null;
    this.stopLiveBusPoll();
    this.startLiveBusPoll();

    try {
      this.ticketDestination = this.selectedRoute.name || null;

      const stops = this.selectedRoute.stops;
      if (stops && stops.length >= 2) {
        this.fromStopIndex = 0;
        this.toStopIndex = stops.length - 1;
        this.ticketFare = null;
        this.discountPercent = 0;
        this.discountAmount = 0;
        this.applySegmentFare();
        this.ticketId = this.generateTicketId();
        this.saveInProgressTripSnapshot(this.ticketFare ?? this.selectedRoute.basefare ?? 0);
        this.showTicket = true;
        return;
      }

      if (stops && stops.length === 1) {
        this.ticketFare = null;
        this.discountPercent = 0;
        this.discountAmount = 0;
        this.applyFareForStopChoice();
        this.ticketId = this.generateTicketId();
        this.saveInProgressTripSnapshot(this.ticketFare ?? this.selectedRoute.basefare ?? 0);
        this.showTicket = true;
        return;
      }

      const passengerType = this.commuterService.getPassengerType();
      this.commuterService.calculateFareWithDiscount(this.selectedRoute.id, passengerType).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.ticketFare = response.data.final_fare;
            this.discountPercent = response.data.discount_percent || 0;
            this.discountAmount = response.data.discount_amount || 0;
            if (response.data.discount_amount > 0) {
              this.showToast(
                `${passengerType} Discount Applied: -₱${response.data.discount_amount} (${response.data.discount_percent}%)`,
                'success'
              );
            }
          }
          this.ticketId = this.generateTicketId();
          this.saveInProgressTripSnapshot(this.ticketFare ?? this.selectedRoute?.basefare ?? 0);
          this.showTicket = true;
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare || 0;
          this.ticketId = this.generateTicketId();
          this.saveInProgressTripSnapshot(this.ticketFare ?? 0);
          this.showTicket = true;
        },
      });
    } catch (e) {
      console.error('Failed to set ticket data on selection:', e);
    }
  }

  onStopChoiceChange() {
    this.applyFareForStopChoice();
  }

  onSegmentStopsChange() {
    if (!this.selectedRoute?.stops?.length) return;
    const max = this.selectedRoute.stops.length - 1;
    if (this.fromStopIndex < 0) this.fromStopIndex = 0;
    if (this.toStopIndex > max) this.toStopIndex = max;
    if (this.fromStopIndex >= this.toStopIndex) {
      this.toStopIndex = Math.min(max, this.fromStopIndex + 1);
    }
    this.applySegmentFare();
    if (this.selectedScheduleId) {
      this.autoFlagForBoarding();
    }
  }

  private applySegmentFare() {
    if (!this.selectedRoute?.stops || this.selectedRoute.stops.length < 2) return;
    this.commuterService
      .fareSegment({
        route_id: parseInt(this.selectedRoute.id, 10),
        from_stop_index: this.fromStopIndex,
        to_stop_index: this.toStopIndex,
        approval_request_id: this.selectedRoute.approval_request_id,
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.ticketFare = res.data.final_fare;
            this.discountPercent = res.data.discount_percent || 0;
            this.discountAmount = res.data.discount_amount || 0;
            const from = this.selectedRoute!.stops![this.fromStopIndex];
            const to = this.selectedRoute!.stops![this.toStopIndex];
            this.ticketDestination = `${from?.name || 'Boarding'} → ${to?.name || 'Alighting'}`;
          }
        },
        error: () => {
          if (this.ticketFare == null) {
            this.ticketFare = this.selectedRoute?.basefare ?? 0;
          }
        },
      });
  }

  private stopLiveBusPoll(): void {
    if (this.liveBusPollTimer) {
      clearInterval(this.liveBusPollTimer);
      this.liveBusPollTimer = null;
    }
  }

  private startLiveBusPoll(): void {
    this.stopLiveBusPoll();
    this.refreshLiveBuses();
    this.liveBusPollTimer = setInterval(() => this.refreshLiveBuses(), 5000);
  }

  private refreshLiveBuses(): void {
    if (!this.selectedRoute?.id) {
      this.liveBuses = [];
      this.liveBusMapPins = [];
      return;
    }
    this.commuterService.getLiveBuses(String(this.selectedRoute.id), this.commuterTerminal).subscribe({
      next: (res) => {
        if (!res.success || !Array.isArray(res.buses)) {
          this.liveBuses = [];
          this.liveBusMapPins = [];
          this.selectedScheduleId = null;
          return;
        }
        this.liveBuses = res.buses;
        this.updateLiveBusMapPins();
        if (
          this.selectedScheduleId != null &&
          !this.liveBuses.some((b) => b.schedule_id === this.selectedScheduleId)
        ) {
          this.selectedScheduleId = null;
          this.updateLiveBusMapPins();
        }
        this.autoSelectSingleLiveBus();
        this.checkAlightFromLivePosition();
      },
      error: () => {
        this.liveBuses = [];
        this.liveBusMapPins = [];
      },
    });
  }

  /** Auto-select if only one non-full bus; otherwise the commuter must pick. */
  private autoSelectSingleLiveBus(): void {
    const open = this.liveBuses.filter((b) => !b.is_full);
    if (open.length !== 1) {
      return;
    }
    if (this.selectedScheduleId != null) {
      return;
    }
    this.selectedScheduleId = open[0].schedule_id;
    this.updateLiveBusMapPins();
    this.syncTicketBusLabelsForETicket();
  }

  private updateLiveBusMapPins(): void {
    this.liveBusMapPins = this.liveBuses
      .filter((b) => b.position != null && Number.isFinite(b.position.lng) && Number.isFinite(b.position.lat))
      .map((b) => ({
        lng: b.position!.lng,
        lat: b.position!.lat,
        label: `${b.bus_number || 'Bus'} · ${b.operator_company || 'Operator'} · ${b.driver_name || ''}${
          b.is_full ? ' · FULL' : ''
        }`,
        color: this.selectedScheduleId === b.schedule_id ? '#f97316' : b.is_full ? '#dc2626' : '#0074D9',
        scheduleId: b.schedule_id,
        selected: this.selectedScheduleId === b.schedule_id,
        status: b.status,
      }));
  }

  selectLiveBus(b: LiveBusTrip): void {
    if (b.is_full) {
      void this.showToast('This bus is full. Choose another.', 'warning');
      return;
    }
    this.selectedScheduleId = b.schedule_id;
    this.updateLiveBusMapPins();
    this.syncTicketBusLabelsForETicket();
    const stops = this.selectedRoute?.stops;
    if (stops && stops.length >= 2 && this.fromStopIndex < this.toStopIndex) {
      this.autoFlagForBoarding();
    }
  }

  private syncTicketBusLabelsForETicket(): void {
    const b = this.liveBuses.find((x) => x.schedule_id === this.selectedScheduleId);
    if (b) {
      this.ticketOperatorCompany = b.operator_company || '';
      const parts = [b.bus_number, b.plate_number].filter((p) => p != null && String(p).trim() !== '');
      this.ticketBusLabel = parts.length ? parts.join(' · ') : b.bus_number || '';
    } else {
      this.ticketOperatorCompany = '';
      this.ticketBusLabel = '';
    }
  }

  /** Fare proportional to distance along route (backend fare-preview) */
  private applyFareForStopChoice() {
    if (!this.selectedRoute?.stops?.length) return;

    let idx = this.selectedRoute.stops.length - 1;
    if (this.stopChoice !== 'terminus' && this.stopChoice !== '') {
      const n = typeof this.stopChoice === 'string' ? parseInt(this.stopChoice, 10) : Number(this.stopChoice);
      if (!Number.isNaN(n)) idx = n;
    }

    this.commuterService
      .previewFareAtStop(this.selectedRoute!.id, idx, this.selectedRoute!.approval_request_id)
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.fare != null) {
            this.ticketFare = res.data.fare;
            const stop = this.selectedRoute!.stops![idx];
            this.ticketDestination = `${this.selectedRoute!.name} → ${stop?.name || 'Stop ' + (idx + 1)}`;
          }
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare ?? 0;
        },
      });
  }

  private autoFlagForBoarding(): void {
    if (!this.selectedRoute || !this.selectedScheduleId) return;
    const stops = this.selectedRoute.stops;
    if (stops && stops.length >= 2 && this.fromStopIndex >= this.toStopIndex) return;

    // If a request is still in-flight, mark that we need to retry when it settles.
    if (this.boardingReqInFlight) {
      this.boardingReqPendingRetry = true;
      return;
    }

    if (this.boardingRequestId) {
      this.commuterService.cancelBoardingRequest(this.boardingRequestId).subscribe({ error: () => {} });
      this.boardingRequestId = null;
      this.boardingRequested = false;
    }

    this.boardingReqInFlight = true;
    this.boardingReqPendingRetry = false;
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    this.commuterService.requestBoarding({
      schedule_id: this.selectedScheduleId,
      route_id: parseInt(this.selectedRoute.id, 10),
      from_stop_index: this.fromStopIndex,
      commuter_id: this.getCommuterId(),
      commuter_name: currentUser.name || currentUser.first_name || null,
      commuter_email: currentUser.email || null,
      terminal: this.commuterTerminal,
      approval_request_id: this.selectedRoute.approval_request_id,
    }).subscribe({
      next: (res) => {
        this.boardingReqInFlight = false;
        if (this.boardingReqPendingRetry) {
          // Stop selection changed while this request was in-flight — cancel what we just made and retry.
          if (res.id) {
            this.commuterService.cancelBoardingRequest(res.id).subscribe({ error: () => {} });
          }
          this.autoFlagForBoarding();
          return;
        }
        if (res.success) {
          this.boardingRequestId = res.id ?? null;
          this.boardingRequested = true;
          this.boardingRequestStopName = res.boarding_stop_name ||
            this.selectedRoute?.stops?.[this.fromStopIndex]?.name || 'your stop';
        }
      },
      error: () => {
        this.boardingReqInFlight = false;
        if (this.boardingReqPendingRetry) {
          this.autoFlagForBoarding();
        }
      },
    });
  }

  cancelFlagBoarding(): void {
    if (!this.boardingRequestId) {
      this.boardingRequested = false;
      return;
    }
    this.commuterService.cancelBoardingRequest(this.boardingRequestId).subscribe({
      next: () => void this.showToast('Boarding request cancelled.', 'medium'),
      error: () => {},
    });
    this.boardingRequestId = null;
    this.boardingRequested = false;
  }

  private resetBoardingRequest(): void {
    this.boardingReqInFlight = false;
    this.boardingReqPendingRetry = false;
    if (this.boardingRequestId) {
      this.commuterService.cancelBoardingRequest(this.boardingRequestId).subscribe({ error: () => {} });
    }
    this.boardingRequestId = null;
    this.boardingRequested = false;
    this.boardingRequestStopName = '';
  }

  private cancelStaleMyBoardingRequests(): void {
    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const identity: { commuter_id?: number; commuter_email?: string; commuter_name?: string } = {};
    const id = this.getCommuterId();
    if (id) identity.commuter_id = id;
    if (currentUser.email) identity.commuter_email = currentUser.email;
    const name = currentUser.name || currentUser.first_name || null;
    if (name) identity.commuter_name = name;
    if (Object.keys(identity).length === 0) return;
    this.commuterService.cancelMyBoardingRequests(identity).subscribe({ error: () => {} });
  }

  onTrackRoute() {
    if (!this.selectedRoute) {
      this.showToast('Please select a route to track', 'warning');
      return;
    }
    console.log('Tracking route requested for:', this.selectedRoute);
    // For now we just notify the user; future improvement: navigate to a live-tracking view
    this.showToast(`Tracking ${this.selectedRoute.name}`, 'success');
  }

  // Quick pay flow for demo: pays with passenger type discount applied
  async payFare() {
    if (!this.selectedRoute) {
      this.showToast('Select a route first', 'warning');
      return;
    }
    
    // Calculate fare with passenger type discount from backend
    const passengerType = this.commuterService.getPassengerType();
    
    this.commuterService.calculateFareWithDiscount(
      this.selectedRoute.id,
      passengerType
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.ticketDestination = this.selectedRoute?.name || null;
          this.confirmTicketWithBackend(
            response.data.final_fare,
            response.data.discount_percent || 0,
            response.data.discount_amount || 0,
            passengerType
          );
        }
      },
      error: (error) => {
        console.error('Error calculating fare:', error);
        this.showToast('Error calculating fare', 'danger');
      }
    });
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'top'
    });
    toast.present();
  }

  /** Confirm route, fare, and payment before calling the booking APIs. */
  async confirmBeforeGetETicket() {
    if (!this.selectedRoute) return;

    if (this.liveBuses.length > 0 && this.selectedScheduleId == null) {
      void this.showToast('Select an active bus for this route first.', 'warning');
      return;
    }

    const stops = this.selectedRoute.stops;
    if (stops && stops.length >= 2 && this.fromStopIndex >= this.toStopIndex) {
      void this.showToast('Boarding stop must come before your alighting stop.', 'warning');
      return;
    }

    const fare = Number(this.ticketFare ?? this.selectedRoute.basefare ?? 0);
    const routeName = this.selectedRoute.name || 'This route';
    const pay = this.getPaymentMethodLabel();
    const tripLine =
      this.ticketDestination && this.ticketDestination !== routeName
        ? `\n${this.ticketDestination}`
        : '';

    const alert = await this.alertController.create({
      header: 'Get e-Ticket?',
      subHeader: routeName,
      message: `Fare: ₱${fare.toFixed(2)}\nPayment: ${pay}${tripLine}\n\nBook this ticket now?`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Confirm',
          handler: () => {
            this.generateTicket();
          },
        },
      ],
    });
    await alert.present();
  }

  generateTicket() {
    if (!this.selectedRoute) return;

    if (this.liveBuses.length > 0 && this.selectedScheduleId == null) {
      const first = this.liveBuses.find(b => !b.is_full);
      if (first) {
        this.selectLiveBus(first);
      }
    }

    const stops = this.selectedRoute.stops;
    if (stops && stops.length >= 2 && this.fromStopIndex >= this.toStopIndex) {
      void this.showToast('Boarding stop must come before your alighting stop.', 'warning');
      return;
    }

    const passengerType = this.commuterService.getPassengerType();

    if (stops && stops.length >= 2) {
      this.commuterService
        .fareSegment({
          route_id: parseInt(this.selectedRoute.id, 10),
          from_stop_index: this.fromStopIndex,
          to_stop_index: this.toStopIndex,
          approval_request_id: this.selectedRoute.approval_request_id,
        })
        .subscribe({
          next: (response) => {
            if (response.success && response.data) {
              this.confirmTicketWithBackend(
                response.data.final_fare,
                response.data.discount_percent || 0,
                response.data.discount_amount || 0,
                passengerType
              );
            }
          },
          error: () => {
            void this.showToast('Could not calculate fare for this segment.', 'danger');
          },
        });
      return;
    }

    this.ticketDestination = this.selectedRoute.name;
    this.commuterService.calculateFareWithDiscount(this.selectedRoute.id, passengerType).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          this.confirmTicketWithBackend(
            response.data.final_fare,
            response.data.discount_percent || 0,
            response.data.discount_amount || 0,
            passengerType
          );
        }
      },
      error: (error) => {
        console.error('Error calculating fare:', error);
        const base = this.selectedRoute?.basefare ?? 0;
        void this.showToast(
          'Fare service unavailable — saving ticket at listed fare if a trip exists today.',
          'warning'
        );
        this.confirmTicketWithBackend(base, 0, 0, this.commuterService.getPassengerType());
      },
    });
  }

  private generateTicketId(): string {
    // Generate a unique ticket ID based on timestamp and random number
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `${timestamp}-${random}`;
    console.log('generateTicketId called, ID:', id);
    return id;
  }

  private getCommuterId(): number | undefined {
    try {
      const raw = sessionStorage.getItem('currentUser');
      if (!raw) return undefined;
      const u = JSON.parse(raw) as { id?: number; commuter_id?: number };
      const id = u.id ?? u.commuter_id;
      if (typeof id === 'number' && !Number.isNaN(id)) return id;
      if (id != null) {
        const n = parseInt(String(id), 10);
        return Number.isNaN(n) ? undefined : n;
      }
      return undefined;
    } catch {
      return undefined;
    }
  }

  /**
   * Marks tickets as alighted so driver/operator “aboard” counts drop; trip revenue rows stay.
   */
  private notifyAlighted(): void {
    if (this.alightNotified || !this.ticketId) {
      return;
    }
    this.alightNotified = true;
    this.commuterService.alight(this.ticketId).subscribe({
      error: (err) => console.warn('alight request failed', err),
    });
  }

  private bookingErrorMessage(err: unknown): string {
    const anyErr = err as { error?: { message?: string }; message?: string };
    const m = anyErr?.error?.message ?? anyErr?.message;
    return typeof m === 'string' && m.length > 0
      ? m
      : 'Could not register e-ticket with the operator.';
  }

  /**
   * Saves ticket to Laravel (trip logs + driver boarding list), then shows the e-ticket UI.
   */
  private confirmTicketWithBackend(
    finalFare: number,
    discountPercent: number,
    discountAmount: number,
    passengerType: string
  ): void {
    const route = this.selectedRoute;
    if (!route) return;

    this.alightNotified = false;
    this.ticketId = this.generateTicketId();
    this.commuterService
      .bookTicket({
        route_id: parseInt(route.id, 10),
        schedule_id: this.selectedScheduleId ?? undefined,
        public_ticket_id: this.ticketId,
        fare: finalFare,
        commuter_id: this.getCommuterId(),
        payment_method: this.paymentMethod,
        from_stop_index: this.fromStopIndex,
      })
      .subscribe({
        next: (bookRes) => {
          if (!bookRes.success) {
            void this.showToast(bookRes.message || 'Could not register e-ticket.', 'danger');
            return;
          }
          this.ticketFare = finalFare;
          this.discountPercent = discountPercent;
          this.discountAmount = discountAmount;
          this.syncTicketBusLabelsForETicket();
          this.saveInProgressTripSnapshot(finalFare);
          this.showTicket = true;
          this.startBusSimulation();
          let message = `e-Ticket generated! Fare: ₱${finalFare.toFixed(2)}`;
          if (discountAmount > 0) {
            message += ` (${passengerType} discount: -₱${discountAmount})`;
          }
          void this.showToast(message, 'success');
        },
        error: (err) => {
          console.error('bookTicket error', err);
          const msg = err?.error?.message || 'No driver is currently active on this route. Please wait for the driver to start the trip.';
          void this.showToast(msg, 'danger');
        },
      });
  }

  getPaymentMethodLabel(): string {
    const labels: { [key: string]: string } = {
      'cash': 'Cash',
      'paymaya': 'PayMaya',
      'gcash': 'GCash'
    };
    return labels[this.paymentMethod] || 'Cash';
  }

  getPaymentIcon(): string {
    const icons: { [key: string]: string } = {
      'cash': 'cash-outline',
      'paymaya': 'card-outline',
      'gcash': 'phone-portrait-outline'
    };
    return icons[this.paymentMethod] || 'cash-outline';
  }

  get eTicketPayload(): string {
    if (!this.ticketId || !this.selectedRoute) return '';
    const fare = this.ticketFare ?? this.selectedRoute?.basefare ?? 0;
    return [this.ticketId, this.selectedRoute.name, fare, this.currentTime].join('|');
  }

  openQrScanner() {
    this.showQrScanner = true;
  }

  async onPaymentScanned(payment: ScannedPayment) {
    this.showQrScanner = false;

    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const userId = currentUser.id || '';
    const methods: any[] = JSON.parse(localStorage.getItem(`paymentMethods_${userId}`) || '[]');
    const defaultMethod = methods.find(m => m.isDefault) ?? methods[0] ?? null;

    const fare = payment.fareOverride ?? this.ticketFare ?? this.selectedRoute?.basefare ?? 0;
    const fareDisplay = `₱${(+fare).toFixed(2)}`;

    let paymentLine: string;
    let balanceLine = '';

    if (defaultMethod && defaultMethod.type !== 'cash') {
      const label = defaultMethod.type === 'gcash' ? 'GCash' : 'PayMaya';
      const masked = defaultMethod.number?.replace(/\d(?=\d{4})/g, '•') ?? '';
      paymentLine = `${label} ${masked}`;
      if (defaultMethod.type !== 'paymaya') {
        try {
          const bal = await this.paymentService.getEWalletBalance(defaultMethod.number);
          balanceLine = `\nBalance: ₱${(+bal).toFixed(2)}`;
        } catch {}
      }
    } else {
      paymentLine = 'Cash — pay conductor directly';
    }

    const alert = await this.alertController.create({
      header: 'Confirm Payment',
      message: `Route: ${payment.routeName}\nFare: ${fareDisplay}\nPay via: ${paymentLine}${balanceLine}`,
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        { text: 'Confirm & Board', handler: () => this.finalizePayment(payment, defaultMethod, fare) }
      ]
    });
    await alert.present();
  }

  private async finalizePayment(payment: ScannedPayment, method: any, fare: number) {
    const type = method?.type ?? 'cash';

    // Real Maya checkout — opens popup, waits for postMessage result
    if (type === 'paymaya') {
      await this.openMayaCheckout(payment, fare);
      return;
    }

    if (type === 'gcash') {
      const result = await this.paymentService.processEWalletPayment(fare, method.number, type);
      if (!result.success) {
        void this.showToast(result.error ?? 'GCash payment failed.', 'danger');
        return;
      }
      await this.completeBooking(payment, type, fare, result.paymentIntentId ?? null);
      return;
    }

    if (type === 'card') {
      this.pendingPayment = { payment, method, fare };
      this.showCardPayment = true;
      return;
    }

    // cash
    await this.completeBooking(payment, 'cash', fare, null);
  }

  private async openMayaCheckout(payment: ScannedPayment, fare: number) {
    const loading = await this.loadingController.create({ message: 'Opening Maya payment…' });
    await loading.present();

    const currentUser = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
    const commuterName = currentUser.name || currentUser.first_name || 'Commuter';

    const result = await this.paymentService.createMayaCheckout({
      public_ticket_id: payment.ticketIdOverride || this.ticketId,
      amount: fare,
      route_name: this.selectedRoute?.name,
      commuter_name: commuterName,
    });

    await loading.dismiss();

    if (!result.success || !result.checkout_url) {
      void this.showToast(result.message ?? 'Could not start Maya payment.', 'danger');
      return;
    }

    // Store app origin in localStorage so the callback page can redirect back if popup is blocked
    localStorage.setItem('transittrack_app_origin', window.location.origin);

    // Remove any previous listener
    if (this.mayaMessageHandler) {
      window.removeEventListener('message', this.mayaMessageHandler);
    }

    this.pendingMayaPayment = { payment, fare };

    // Listen for the result posted by the Maya callback page
    this.mayaMessageHandler = (event: MessageEvent) => {
      if (event.data?.type !== 'MAYA_PAYMENT_RESULT') return;
      window.removeEventListener('message', this.mayaMessageHandler!);
      this.mayaMessageHandler = null;

      this.ngZone.run(async () => {
        const { status, ticketId } = event.data;
        const pending = this.pendingMayaPayment;
        this.pendingMayaPayment = null;

        if (status === 'success' && pending) {
          await this.completeBooking(pending.payment, 'paymaya', pending.fare, ticketId ?? null);
        } else if (status === 'cancelled') {
          void this.showToast('Maya payment cancelled.', 'medium');
        } else {
          void this.showToast('Maya payment failed. Please try again.', 'danger');
        }
      });
    };

    window.addEventListener('message', this.mayaMessageHandler);

    // Open Maya checkout in a popup window
    const popup = window.open(result.checkout_url, 'maya_payment', 'width=520,height=680,left=200,top=100');

    if (!popup || popup.closed) {
      window.removeEventListener('message', this.mayaMessageHandler);
      this.mayaMessageHandler = null;
      this.pendingMayaPayment = null;
      void this.showToast('Popup blocked. Please allow popups for this site and try again.', 'warning');
      return;
    }

    // Poll popup.closed as fallback — handles the case where the callback page
    // closes the window without postMessage getting through
    const ticketRef = payment.ticketIdOverride || this.ticketId;
    const pollInterval = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(pollInterval);
      if (this.mayaMessageHandler) {
        window.removeEventListener('message', this.mayaMessageHandler);
        this.mayaMessageHandler = null;
      }
      const pending = this.pendingMayaPayment;
      this.pendingMayaPayment = null;
      if (!pending) return;

      // Check localStorage flag set by the callback page
      const paidTicket = localStorage.getItem('maya_paid_ticket');
      if (paidTicket === ticketRef) {
        localStorage.removeItem('maya_paid_ticket');
        this.ngZone.run(() => this.completeBooking(pending.payment, 'paymaya', pending.fare, paidTicket));
      } else {
        this.ngZone.run(() => this.showToast('Payment not completed. Try again.', 'medium'));
      }
    }, 800);
  }

  async onCardPaid(result: PaymentResult) {
    this.showCardPayment = false;
    if (!this.pendingPayment) return;
    const { payment, method, fare } = this.pendingPayment;
    this.pendingPayment = null;
    await this.completeBooking(payment, method?.type ?? 'card', fare, result.paymentIntentId ?? null);
  }

  private async completeBooking(payment: ScannedPayment, methodType: string, fare: number, transactionId: string | null) {
    const ticketId = payment.ticketIdOverride || this.ticketId;
    this.commuterService.bookTicket({
      route_id: payment.routeId || parseInt(this.selectedRoute?.id ?? '0', 10),
      schedule_id: payment.scheduleId || undefined,
      fare,
      public_ticket_id: ticketId,
      payment_method: methodType,
      commuter_id: JSON.parse(sessionStorage.getItem('currentUser') || '{}').id ?? undefined,
    }).subscribe();

    // Mark the ticket as paid on the backend so the driver manifest reflects it
    if (ticketId && methodType !== 'cash') {
      this.commuterService.markTicketPaid(ticketId, methodType).subscribe({
        error: (err) => console.warn('markTicketPaid failed', err)
      });
    }

    if (ticketId) {
      this.tripHistoryService.updateLocalTrip(ticketId, { status: 'paid', paymentMethod: methodType });

      // Save receipt to localStorage for display in Trip History
      const receipt = {
        ticketId,
        fare,
        paymentMethod: methodType === 'paymaya' ? 'PayMaya' : methodType === 'gcash' ? 'GCash' : methodType === 'card' ? 'Card' : 'Cash',
        routeName: this.selectedRoute?.name || '',
        paidAt: new Date().toISOString(),
        transactionRef: transactionId || ('TT-' + ticketId.slice(-10).toUpperCase()),
      };
      localStorage.setItem(`receipt_${ticketId}`, JSON.stringify(receipt));
    }

    // Hide fare/ticket UI but keep route so the map stays visible
    this.showTicket = false;
    this.paymentCompleted = true;
    this.ticketFare = null;
    this.ticketId = '';
    this.saveActiveTrip(); // persist so refresh doesn't re-show the payment screen

    const label = methodType === 'card' ? 'Card' : methodType === 'gcash' ? 'GCash' : methodType === 'paymaya' ? 'PayMaya' : 'Cash';
    void this.showToast(`Payment confirmed via ${label}. Check Trip History for your receipt.`, 'success');
  }

  async closeTicket() {
    const alert = await this.alertController.create({
      header: 'End Trip?',
      message: 'Have you arrived at your destination?',
      buttons: [
        { text: 'Not yet', role: 'cancel' },
        {
          text: "Yes, I've arrived",
          handler: () => this.finalizeTripFromTicket(),
        },
      ],
    });
    await alert.present();
  }

  /** Completes local trip + notifies operator; call when commuter confirms they have alighted. */
  private finalizeTripFromTicket(): void {
    const bus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
    this.completedTripInfo = {
      routeName: this.selectedRoute?.name || '',
      fare: this.ticketFare ?? this.selectedRoute?.basefare ?? 0,
      driverName: bus?.driver_name || 'Your Driver',
      scheduleId: this.selectedScheduleId,
      ticketId: this.ticketId,
      boardStopName: this.selectedRoute?.stops?.[this.fromStopIndex]?.name || '',
      alightStopName: this.selectedRoute?.stops?.[this.toStopIndex]?.name || '',
    };

    this.resetBoardingRequest();
    this.notifyAlighted();
    if (this.ticketId) {
      const arrived = new Date().toISOString();
      this.tripHistoryService.updateLocalTrip(this.ticketId, {
        status: 'completed',
        arrivalTime: arrived,
        duration: this.computeTripDurationLabel(arrived),
      });
    }
    this.showTicket = false;
    this.stopBusSimulation();
    this.alightStopReached = false;
    this.alightNotified = false;
    this.selectedRoute = null;
    this.selectedRouteId = '';
    this.ticketFare = null;
    this.ticketId = '';
    this.paymentCompleted = false;
    this.stopLiveBusPoll();
    this.liveBuses = [];
    this.liveBusMapPins = [];
    this.syncStopPinsForMap();
    localStorage.removeItem(this.getTripStateKey());
    this.selectedRating = 0;
    this.ratingComment = '';
    this.showRatingModal = true;
  }

  private computeTripDurationLabel(arrivalIso: string): string {
    const trips = this.tripHistoryService.getLocalTripsSync();
    const row = trips.find((t: any) => t.id === this.ticketId);
    const dep = row?.departureTime ? new Date(row.departureTime as string).getTime() : NaN;
    const arr = new Date(arrivalIso).getTime();
    if (Number.isNaN(dep) || Number.isNaN(arr) || arr <= dep) {
      return '';
    }
    const mins = Math.round((arr - dep) / 60000);
    if (mins < 60) return `${mins} min`;
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return `${h}h ${m}m`;
  }

  private saveInProgressTripSnapshot(fare: number): void {
    const route = this.selectedRoute;
    if (!route || !this.ticketId) return;
    const distanceKm = route.distance_km;
    this.tripHistoryService.upsertLocalTrip({
      id: this.ticketId,
      routeName: route.name || '',
      departure: this.getOrigin(),
      arrival: this.getDestinationPoint(),
      departureTime: new Date().toISOString(),
      arrivalTime: '',
      fare,
      paymentMethod: this.paymentMethod,
      status: 'in-progress',
      driverName: '',
      busPlateNumber: this.ticketBusLabel || '',
      tripDate: new Date().toISOString(),
      distance: typeof distanceKm === 'string' ? parseFloat(distanceKm) : (distanceKm || 0),
      duration: '',
    });
  }

  async shareTicket() {
    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Transit e-Ticket',
          text: `My e-Ticket for ${this.ticketDestination} - Ticket ID: #${this.ticketId}`,
          url: window.location.href
        });
        this.showToast('Ticket shared successfully!', 'success');
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      const ticketInfo = `Transit e-Ticket\nRoute: ${this.ticketDestination}\nTicket ID: #${this.ticketId}\nFare: ₱${this.ticketFare}\nPayment: ${this.getPaymentMethodLabel()}`;
      
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(ticketInfo);
          this.showToast('Ticket details copied to clipboard!', 'success');
        } catch (error) {
          this.showToast('Unable to share ticket', 'warning');
        }
      } else {
        this.showToast('Sharing not supported on this device', 'warning');
      }
    }
  }

  async handleMakeStop() {
    if (!this.selectedRoute) return;

    const currentFare = this.ticketFare || this.selectedRoute.basefare;

    const alert = await this.alertController.create({
      header: 'Make Stop & Pay',
      message: `
        <div style="text-align: center; padding: 10px;">
          <p style="font-size: 16px; margin: 10px 0;">Ready to get off?</p>
          <p style="font-size: 14px; color: #666;">Distance traveled: ${this.getDistanceTraveled()}</p>
          <p style="font-size: 14px; color: #666;">Please pay ₱${currentFare.toFixed(2)} to the conductor</p>
        </div>
      `,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Confirm Payment',
          handler: async () => {
            // Show loading
            const loading = await this.loadingController.create({
              message: 'Processing...',
              duration: 1000
            });
            await loading.present();

            setTimeout(async () => {
              await loading.dismiss();
              
              // Stop bus simulation
              this.stopBusSimulation();
              
              // Close ticket and show receipt
              this.showTicket = false;
              this.selectedRoute = null;
              this.syncStopPinsForMap();
              
              const receiptAlert = await this.alertController.create({
                header: '✅ Payment Confirmed',
                message: `
                  <div style="text-align: center; padding: 10px;">
                    <p style="font-size: 16px; margin: 10px 0;">Thank you for riding with us!</p>
                    <p style="font-size: 14px; color: #666;">Distance: ${this.getDistanceTraveled()}</p>
                    <p style="font-size: 14px; color: #666;">Fare: ₱${currentFare.toFixed(2)}</p>
                    <p style="font-size: 14px; color: #666;">Receipt sent to your account</p>
                  </div>
                `,
                buttons: ['Done']
              });
              await receiptAlert.present();
              
              this.showToast('Trip completed successfully', 'success');
            }, 1000);
          }
        }
      ]
    });

    await alert.present();
  }

  updateCurrentTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Get the calculated distance for a route
   * @param route The route object
   * @returns Formatted distance string (e.g., "12.5 km")
   */
  getRouteDistance(route: LiveRoute | null): string {
    if (!route) {
      return '—';
    }
    
    // Use the distance_km from backend
    if (route.distance_km && route.distance_km > 0) {
      const distance = typeof route.distance_km === 'string' ? parseFloat(route.distance_km) : route.distance_km;
      if (distance < 1) {
        return `${Math.round(distance * 1000)} m`;
      }
      return `${distance.toFixed(1)} km`;
    }
    
    return '—';
  }

  /**
   * Start bus simulation for route visualization and distance tracking
   * Note: Fare is fixed (basefare), simulation shows route progress and distance only
   */
  private startBusSimulation() {
    // Stop any existing simulation
    this.stopBusSimulation();

    if (!this.selectedRoute?.geometry?.coordinates) {
      console.warn('Cannot start simulation: No route geometry available');
      return;
    }

    const coords = this.selectedRoute.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      console.warn('Cannot start simulation: Invalid coordinates');
      return;
    }

    // Set boarding location as the first coordinate (route start)
    const firstCoord = coords[0];
    console.log('First coordinate from route:', firstCoord);
    
    this.boardingLocation = {
      lng: Number(firstCoord[0]),
      lat: Number(firstCoord[1])
    };
    
    console.log('Boarding location set to:', this.boardingLocation);
    
    // Validate boarding location
    if (isNaN(this.boardingLocation.lng) || isNaN(this.boardingLocation.lat)) {
      console.error('Invalid boarding location coordinates!');
      return;
    }
    
    this.currentBusPosition = { ...this.boardingLocation };
    this.distanceTraveled = 0;
    this.isSimulationActive = true;
    this.alightStopReached = false;
    const totalDistance = this.selectedRoute.distance_km || 0;
    const totalSteps = coords.length;

    this.busSimulationSubscription = this.busSimulator
      .simulateAlongLine(coords, 2000)
      .subscribe({
        next: (position) => {
          if (!position || isNaN(position.lng) || isNaN(position.lat)) return;
          this.currentBusPosition = { lng: position.lng, lat: position.lat };
          if (totalDistance > 0 && totalSteps > 0) {
            this.distanceTraveled = totalDistance * (position.index / totalSteps);
          }
        },
        complete: () => {
          this.busSimulationSubscription = null;
          this.isSimulationActive = false;
        },
        error: (err) => {
          console.error('Bus simulation error:', err);
          this.stopBusSimulation();
        }
      });
  }


  /** Called after each live bus poll to check if the selected bus has reached the alight stop. */
  private checkAlightFromLivePosition(): void {
    if (this.alightStopReached) return;
    if (!this.showTicket && !this.paymentCompleted) return;
    if (!this.selectedScheduleId) return;

    // Use the terminal manager's stop lat/lng directly — no route geometry needed
    const destStop = this.selectedRoute?.stops?.[this.toStopIndex];
    if (!destStop) return;
    const dLng = Number(destStop.lng), dLat = Number(destStop.lat);
    if (isNaN(dLng) || isNaN(dLat)) return;

    const selectedBus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
    if (!selectedBus?.position) return;

    const dist = new mapboxgl.LngLat(selectedBus.position.lng, selectedBus.position.lat)
      .distanceTo(new mapboxgl.LngLat(dLng, dLat));

    if (dist <= 500) { // within 500 m of the terminal-defined stop
      this.alightStopReached = true;

      // Capture trip info before clearing state
      const arrivedBus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
      this.completedTripInfo = {
        routeName: this.selectedRoute?.name || '',
        fare: this.ticketFare ?? this.selectedRoute?.basefare ?? 0,
        driverName: arrivedBus?.driver_name || 'Your Driver',
        scheduleId: this.selectedScheduleId,
        ticketId: this.ticketId,
        boardStopName: this.selectedRoute?.stops?.[this.fromStopIndex]?.name || '',
        alightStopName: this.selectedRoute?.stops?.[this.toStopIndex]?.name || '',
      };

      this.stopLiveBusPoll(); // freeze the marker for 5 seconds
      void this.showToast('Arriving at your stop! Please prepare to get off.', 'warning');
      setTimeout(() => {
        this.notifyAlighted();
        void this.showToast('You have arrived at your stop. Have a safe trip!', 'success');
        // Clear active trip state — map/ticket sections disappear via *ngIf="selectedRoute"
        this.showTicket = false;
        this.paymentCompleted = false;
        this.selectedRoute = null;
        this.selectedRouteId = '';
        this.ticketFare = null;
        this.ticketId = '';
        this.stopBusSimulation();
        this.liveBuses = [];
        this.liveBusMapPins = [];
        this.syncStopPinsForMap();
        localStorage.removeItem(this.getTripStateKey());
        this.selectedRating = 0;
        this.ratingComment = '';
        this.showRatingModal = true;
      }, 5000);
    }
  }

  /**
   * Stop the bus simulation
   */
  private stopBusSimulation() {
    if (this.busSimulationSubscription) {
      this.busSimulationSubscription.unsubscribe();
      this.busSimulationSubscription = null;
    }
    this.isSimulationActive = false;
    console.log('Bus simulation stopped');
  }



  setRating(stars: number): void {
    this.selectedRating = stars;
  }

  getRatingLabel(): string {
    switch (this.selectedRating) {
      case 1: return 'Poor';
      case 2: return 'Fair';
      case 3: return 'Good';
      case 4: return 'Very Good';
      case 5: return 'Excellent!';
      default: return 'Tap a star to rate';
    }
  }

  submitRating(): void {
    if (this.selectedRating === 0) return;
    this.commuterService.submitFeedback({
      commuter_id: this.getCommuterId() ?? null,
      public_ticket_id: this.completedTripInfo?.ticketId || null,
      schedule_id: this.completedTripInfo?.scheduleId ?? null,
      driver_rating: this.selectedRating,
      comment: this.ratingComment.trim() || null,
    }).subscribe({ error: (e) => console.warn('Feedback submit failed', e) });
    this.showRatingModal = false;
    this.showTripComplete = true;
    void this.showToast('Thanks for your feedback!', 'success');
  }

  skipRating(): void {
    this.showRatingModal = false;
    this.showTripComplete = true;
  }

  bookAnotherTrip(): void {
    this.showTripComplete = false;
    this.showRatingModal = false;
    this.completedTripInfo = null;
    this.selectedRating = 0;
    this.ratingComment = '';
    this.alightStopReached = false;
    this.alightNotified = false;
    this.boardingRequestId = null;
    this.boardingRequested = false;
    this.boardingRequestStopName = '';
  }

  /**
   * Get formatted distance traveled string
   */
  getDistanceTraveled(): string {
    // Handle null, undefined, NaN, or 0
    if (!this.distanceTraveled || this.distanceTraveled === 0 || isNaN(this.distanceTraveled)) {
      return '0.0 km';
    }
    return `${this.distanceTraveled.toFixed(1)} km`;
  }

  /**
   * Get origin point from ticket destination
   */
  getOrigin(): string {
    const t = this.ticketDestination;
    if (!t) return 'Start Point';
    if (t.includes(' → ')) return t.split(' → ')[0]?.trim() || 'Start Point';
    return t.split(' to ')[0]?.trim() || 'Start Point';
  }

  /**
   * Get destination point from ticket destination
   */
  getDestinationPoint(): string {
    const t = this.ticketDestination;
    if (!t) return 'End Point';
    if (t.includes(' → ')) return t.split(' → ')[1]?.trim() || 'End Point';
    return t.split(' to ')[1]?.trim() || 'End Point';
  }
}