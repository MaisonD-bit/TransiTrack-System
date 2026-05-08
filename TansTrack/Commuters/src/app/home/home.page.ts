import { Component, OnInit, OnDestroy } from '@angular/core';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { CommuterService, LiveBusTrip, LiveRoute } from '../services/commuter.service';
import { BusSimulatorService } from '../services/bus-simulator.service';
import { TripHistoryService } from '../services/trip-history.service';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';
import { Router } from '@angular/router';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
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
  /** Dropdown selection for active bus (schedule id) */
  selectedBusScheduleId: number | null = null;
  liveBusMapPins: {
    lng: number;
    lat: number;
    label: string;
    color: string;
    scheduleId?: number;
    selected?: boolean;
  }[] = [];
  selectedScheduleId: number | null = null;
  /** Route line variants (one per active bus) so each bus looks distinct */
  routeLineVariants: { id: number; color: string; offsetPx: number; label: string; selected: boolean }[] = [];
  private liveBusPollTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptions: Subscription[] = [];
  // e-ticket state
  showTicket: boolean = false;
  ticketDestination: string | null = null;
  ticketFare: number | null = null;
  ticketId: string = '';
  paymentMethod: string = 'cash';
  paymentStatus: string = 'unpaid';
  paymentRef: string | null = null;
  qrToken: string | null = null;
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

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    public commuterService: CommuterService,
    private busSimulator: BusSimulatorService,
    private tripHistoryService: TripHistoryService,
    private router: Router
  ) {}

  ngOnInit() {
    this.updateCurrentTime();
    setInterval(() => {
      this.updateCurrentTime();
    }, 60000);
    
    this.loadRouteData();
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

  getTerminalLabel(): string {
    return this.commuterTerminal === 'south' ? 'South Terminal' : 'North Terminal';
  }

  /** UI uses -1 to represent boarding at the selected terminal. */
  get effectiveFromStopIndex(): number {
    const n = Number(this.fromStopIndex);
    return Number.isFinite(n) ? Math.max(0, n) : 0;
  }

  /** UI uses stops.length to represent the route destination (separate from last stop). */
  get destinationIndex(): number {
    const n = this.selectedRoute?.stops?.length ?? 0;
    return typeof n === 'number' && Number.isFinite(n) ? n : 0;
  }

  private getDestinationLabel(): string {
    const stops = this.selectedRoute?.stops ?? [];
    if (stops.length >= 2) {
      const idx =
        typeof this.toStopIndex === 'number' && this.toStopIndex >= 0 && this.toStopIndex < stops.length
          ? this.toStopIndex
          : stops.length - 1;
      const s: any = stops[idx];
      return (s?.name || `Stop ${idx + 1}`) as string;
    }
    return (this.selectedRoute?.name || 'Destination') as string;
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
  }

  loadRouteData() {
    console.log('Home page: Loading route data...');
    // Subscribe to routes data
    const routesSub = this.commuterService.routes$.subscribe(routes => {
      console.log('Home page: Received routes:', routes);
      this.routes = routes;
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
        // Default: commuter boards at the selected terminal (value -1),
        // then arrives at the destination (separate option).
        this.fromStopIndex = -1 as any;
        this.toStopIndex = stops.length; // destinationIndex
        this.ticketFare = null;
        this.discountPercent = 0;
        this.discountAmount = 0;
        this.applySegmentFare();
        this.ticketId = this.generateTicketId();
        this.showTicket = false;
        return;
      }

      if (stops && stops.length === 1) {
        this.ticketFare = null;
        this.discountPercent = 0;
        this.discountAmount = 0;
        this.applyFareForStopChoice();
        this.ticketId = this.generateTicketId();
        this.showTicket = false;
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
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare || 0;
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
    const max = this.destinationIndex; // allow destination option (one past last stop)
    // Allow -1 for terminal.
    if (this.fromStopIndex < -1) this.fromStopIndex = -1 as any;
    if (this.toStopIndex > max) this.toStopIndex = max;
    if (this.effectiveFromStopIndex >= this.toStopIndex) {
      this.toStopIndex = Math.min(max, this.effectiveFromStopIndex + 1);
    }
    this.applySegmentFare();
  }

  private applySegmentFare() {
    if (!this.selectedRoute?.stops || this.selectedRoute.stops.length < 2) return;
    const fromIdx = this.effectiveFromStopIndex;
    const destIdx = this.destinationIndex;
    this.commuterService
      .fareSegment({
        route_id: parseInt(this.selectedRoute.id, 10),
        // send raw UI value so backend can treat -1 as terminal (0 km)
        from_stop_index: Number(this.fromStopIndex),
        to_stop_index: this.toStopIndex,
        approval_request_id: this.selectedRoute.approval_request_id,
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.ticketFare = res.data.final_fare;
            this.discountPercent = res.data.discount_percent || 0;
            this.discountAmount = res.data.discount_amount || 0;
            const from = this.selectedRoute!.stops![fromIdx];
            const fromLabel =
              (this.fromStopIndex as any) === -1 ? this.getTerminalLabel() : (from?.name || 'Boarding');
            const toLabel =
              this.toStopIndex === destIdx
                ? (this.selectedRoute?.name || 'Destination')
                : (this.selectedRoute!.stops![this.toStopIndex]?.name || 'Alighting');
            this.ticketDestination = `${fromLabel} → ${toLabel}`;
          }
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare ?? 0;
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
    this.liveBusPollTimer = setInterval(() => this.refreshLiveBuses(), 15000);
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
        // Keep dropdown value in sync with existing selectedScheduleId
        this.selectedBusScheduleId = this.selectedScheduleId;
        this.updateLiveBusMapPinsAndLines();
        if (
          this.selectedScheduleId != null &&
          !this.liveBuses.some((b) => b.schedule_id === this.selectedScheduleId)
        ) {
          this.selectedScheduleId = null;
          this.selectedBusScheduleId = null;
          this.updateLiveBusMapPinsAndLines();
        }
        this.autoSelectSingleLiveBus();
      },
      error: () => {
        this.liveBuses = [];
        this.liveBusMapPins = [];
      },
    });
  }

  /** If only one non-full bus is running, select it so "Get e-Ticket" is not blocked. */
  private autoSelectSingleLiveBus(): void {
    const open = this.liveBuses.filter((b) => !b.is_full);
    if (open.length !== 1) {
      return;
    }
    if (this.selectedScheduleId != null) {
      return;
    }
    this.selectedScheduleId = open[0].schedule_id;
    this.selectedBusScheduleId = this.selectedScheduleId;
    this.updateLiveBusMapPinsAndLines();
  }

  private updateLiveBusMapPinsAndLines(): void {
    const focusId = this.selectedScheduleId;
    const visibleBuses =
      focusId != null ? this.liveBuses.filter((b) => b.schedule_id === focusId) : this.liveBuses;

    // markers
    this.liveBusMapPins = visibleBuses
      .filter((b) => b.position != null && Number.isFinite(b.position.lng) && Number.isFinite(b.position.lat))
      .map((b) => ({
        lng: b.position!.lng,
        lat: b.position!.lat,
        label: `${b.bus_number || 'Bus'} · ${b.operator_company || 'Operator'} · ${b.driver_name || ''}${
          b.is_full ? ' · FULL' : ''
        }`,
        color: b.is_full ? '#dc2626' : b.status === 'active' ? '#16a34a' : '#2563eb',
        scheduleId: b.schedule_id,
        selected: this.selectedScheduleId === b.schedule_id,
      }));

    // route line variants (visual separation)
    const baseOffsets = [0, 6, -6, 10, -10, 14, -14];
    this.routeLineVariants = this.liveBuses.map((b, idx) => {
      const selected = this.selectedScheduleId != null && this.selectedScheduleId === b.schedule_id;
      const color = b.is_full ? '#dc2626' : b.status === 'active' ? '#16a34a' : '#2563eb';
      const label = `${b.bus_number || 'Bus'}${b.operator_company ? ' · ' + b.operator_company : ''}`;
      const offsetPx = focusId != null ? 0 : (baseOffsets[idx % baseOffsets.length] ?? 0);
      return { id: b.schedule_id, color, offsetPx, label, selected };
    });
  }

  selectLiveBus(b: LiveBusTrip): void {
    if (b.is_full) {
      void this.showToast('This bus is full. Choose another.', 'warning');
      return;
    }
    this.selectedScheduleId = b.schedule_id;
    this.selectedBusScheduleId = this.selectedScheduleId;
    this.updateLiveBusMapPinsAndLines();
    void this.showToast(`Selected ${b.bus_number || 'bus'} — tap Get e-Ticket when ready.`, 'success');
  }

  onBusDropdownChange(scheduleId: number | string | null): void {
    const id = scheduleId != null && scheduleId !== '' ? Number(scheduleId) : null;
    if (id == null || Number.isNaN(id)) {
      this.selectedScheduleId = null;
      this.selectedBusScheduleId = null;
      this.updateLiveBusMapPinsAndLines();
      return;
    }
    const b = this.liveBuses.find((x) => x.schedule_id === id);
    if (!b) {
      this.selectedScheduleId = null;
      this.selectedBusScheduleId = null;
      this.updateLiveBusMapPinsAndLines();
      return;
    }
    this.selectLiveBus(b);
  }

  getSelectedBusCapacityLabel(): string | null {
    const id = this.selectedScheduleId;
    if (id == null) return null;
    const b = this.liveBuses.find((x) => x.schedule_id === id);
    if (!b) return null;
    return `${b.aboard}/${b.capacity}${b.is_full ? ' · FULL' : ''}`;
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

  onTrackRoute() {
    if (!this.selectedRoute) {
      this.showToast('Please select a route to track', 'warning');
      return;
    }

    if (this.liveBuses.length > 0 && this.selectedScheduleId == null) {
      void this.showToast('Select an active bus first to track it live.', 'warning');
      return;
    }

    this.router.navigate(['/map'], {
      queryParams: {
        routeId: this.selectedRoute.id,
        scheduleId: this.selectedScheduleId ?? undefined,
      },
    });
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
      void this.showToast('Select an active bus for this route first.', 'warning');
      return;
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
      const raw = localStorage.getItem('currentUser');
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
    this.paymentStatus = this.paymentMethod === 'cash' ? 'unpaid' : 'pending';
    this.paymentRef = null;
    this.qrToken = null;
    this.commuterService
      .bookTicket({
        route_id: parseInt(route.id, 10),
        schedule_id: this.selectedScheduleId ?? undefined,
        public_ticket_id: this.ticketId,
        fare: finalFare,
        commuter_id: this.getCommuterId(),
        payment_method: this.paymentMethod,
        // Save the commuter's intended alighting point so driver arrival can drop aboard count.
        alight_is_destination:
          (this.selectedRoute?.stops?.length ?? 0) >= 2 && this.toStopIndex === this.destinationIndex,
        alight_stop_index:
          (this.selectedRoute?.stops?.length ?? 0) >= 2 && this.toStopIndex !== this.destinationIndex
            ? this.toStopIndex
            : undefined,
      })
      .subscribe({
        next: (bookRes) => {
          if (!bookRes.success) {
            void this.showToast(bookRes.message || 'Could not register e-ticket.', 'danger');
            return;
          }
          this.paymentStatus = (bookRes.data?.payment_status || this.paymentStatus) as string;
          this.paymentRef = (bookRes.data?.payment_ref || null) as string | null;
          this.ticketFare = finalFare;
          this.discountPercent = discountPercent;
          this.discountAmount = discountAmount;
          this.syncTicketBusLabelsForETicket();
          this.saveInProgressTripSnapshot(finalFare);

          if ((this.paymentMethod || '').toLowerCase() === 'cash') {
            this.showTicket = true;
            this.startBusSimulation();
            let message = `e-Ticket generated! Fare: ₱${finalFare.toFixed(2)}`;
            if (discountAmount > 0) {
              message += ` (${passengerType} discount: -₱${discountAmount})`;
            }
            void this.showToast(message, 'success');
            return;
          }

          // Online (simulated) checkout: create → open checkout_url → verify/confirm → then show QR ticket.
          this.commuterService.createPaymayaCheckout(this.ticketId).subscribe({
            next: async (res) => {
              if (!res?.success || !res.data?.checkout_url || !res.data?.ref) {
                void this.showToast(res?.error || 'Could not start checkout.', 'danger');
                return;
              }
              this.paymentRef = res.data.ref;
              this.paymentStatus = 'pending';

              try {
                window.open(res.data.checkout_url, '_blank');
              } catch {
                // If popup blocked, user can still copy/paste from console or retry.
              }

              const alert = await this.alertController.create({
                header: 'Complete PayMaya payment',
                message:
                  'A checkout page was opened. After you complete the payment, tap “I paid” to confirm and generate your QR e-ticket.',
                buttons: [
                  { text: 'Cancel', role: 'cancel' },
                  {
                    text: 'I paid',
                    handler: () => {
                      const ref = this.paymentRef;
                      if (!ref) {
                        void this.showToast('Missing payment reference.', 'danger');
                        return;
                      }
                      this.commuterService.verifyPaymaya(ref).subscribe({
                        next: (vr) => {
                          if (!vr?.success || vr.data?.ticket?.payment_status !== 'paid') {
                            void this.showToast(vr?.message || 'Payment not confirmed yet.', 'warning');
                            return;
                          }
                          this.paymentStatus = vr.data.ticket.payment_status;
                          this.qrToken = vr.data.ticket.qr_payload || null;
                          this.showTicket = true;
                          this.startBusSimulation();
                          void this.showToast('Payment confirmed. QR e-ticket ready.', 'success');
                        },
                        error: () => void this.showToast('Could not verify payment.', 'danger'),
                      });
                    },
                  },
                ],
              });
              await alert.present();
            },
            error: () => void this.showToast('Could not start checkout.', 'danger'),
          });
        },
        error: (err) => {
          console.error('bookTicket error', err);
          void this.showToast(this.bookingErrorMessage(err), 'danger');
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

  async closeTicket() {
    const alert = await this.alertController.create({
      header: 'Close e-Ticket',
      message:
        'Have you gotten off at your stop? Mark the trip complete to update your seat count. You can also finish the trip later from Trip History.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Still traveling',
          handler: () => {
            this.showTicket = false;
            this.stopBusSimulation();
            this.resetRouteSelection();
          },
        },
        {
          text: "I've arrived",
          handler: () => {
            this.finalizeTripFromTicket();
          },
        },
      ],
    });
    await alert.present();
  }

  private resetTicketState(): void {
    // Reset UI state so commuter can generate a fresh ticket immediately.
    this.ticketId = '';
    this.ticketFare = null;
    this.ticketDestination = this.selectedRoute?.name || null;
    this.paymentStatus = this.paymentMethod === 'cash' ? 'unpaid' : 'pending';
    this.paymentRef = null;
    this.qrToken = null;
    this.alightNotified = false;
  }

  private resetRouteSelection(): void {
    this.showTicket = false;
    this.stopBusSimulation();
    this.stopLiveBusPoll();
    this.alightNotified = false;

    this.selectedRouteId = '';
    this.selectedRoute = null;
    this.selectedScheduleId = null;
    this.liveBuses = [];
    this.liveBusMapPins = [];
    this.stopPinsForMap = [];
    this.ticketOperatorCompany = '';
    this.ticketBusLabel = '';
    this.ticketDestination = null;
    this.ticketFare = null;
  }

  /** Completes local trip + notifies operator; call when commuter confirms they have alighted. */
  private finalizeTripFromTicket(): void {
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
    this.resetTicketState();
    this.resetRouteSelection();
    void this.showToast('Trip completed. Thanks for riding!', 'success');
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

    console.log('Starting bus simulation from:', this.boardingLocation);
    console.log('Route has', coords.length, 'coordinate points');
    console.log('First 3 coords:', coords.slice(0, 3));

    // Simulate bus movement at realistic speed (updates every 2 seconds)
    // Realistic bus speed: 50 km/h ≈ 28 meters per 2 seconds
    // Get total distance from Mapbox (already calculated and stored)
    const totalDistance = this.selectedRoute.distance_km || 0;
    const totalSteps = coords.length;
    
    console.log(`Route total distance from Mapbox: ${totalDistance} km, Total steps: ${totalSteps}`);

    this.busSimulationSubscription = this.busSimulator
      .simulateAlongLine(coords, 2000) // Update every 2 seconds
      .subscribe({
        next: (position) => {
          console.log('Received position from simulator:', position);
          
          // Validate position has valid lng/lat
          if (!position || position.lng === undefined || position.lat === undefined || 
              isNaN(position.lng) || isNaN(position.lat)) {
            console.error('Invalid position from simulator:', position);
            return;
          }
          
          this.currentBusPosition = {
            lng: Number(position.lng),
            lat: Number(position.lat)
          };

          // Calculate distance traveled based on progress along route
          // Use Mapbox distance and interpolate based on position index
          if (totalDistance > 0 && totalSteps > 0) {
            const progress = position.index / totalSteps; // 0 to 1
            this.distanceTraveled = totalDistance * progress;
            
            console.log(`Bus at step ${position.index}/${totalSteps}: Distance traveled = ${this.distanceTraveled.toFixed(2)} km (${(progress * 100).toFixed(1)}% of route)`);
          }
        },
        complete: () => {
          this.busSimulationSubscription = null;
          this.isSimulationActive = false;
          this.notifyAlighted();
          void this.showToast('You reached your destination.', 'success');
        },
        error: (err) => {
          console.error('Bus simulation error:', err);
          this.stopBusSimulation();
        }
      });
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