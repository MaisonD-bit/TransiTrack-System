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
  mapRouteGeometry: { type: 'LineString'; coordinates: number[][] } | null = null;
  private mapStopsForRoute: { name?: string; lng: number; lat: number; order?: number; distance_km_from_start?: number; eta_minutes?: number; base_index?: number }[] = [];
  selectedScheduleId: number | null = null;
  private isSelectedBusReturn = false;
  private liveBusPollTimer: ReturnType<typeof setInterval> | null = null;
  private subscriptions: Subscription[] = [];
  // e-ticket state
  showTicket: boolean = false;
  paymentCompleted: boolean = false;
  ticketDestination: string | null = null;
  ticketFare: number | null = null;
  ticketId: string = '';
  paymentMethod: string = 'cash';
  /** True once bookTicket() has been sent for this ticketId — prevents duplicate calls in completeBooking(). */
  private ticketPersistedToBackend: boolean = false;
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
  /** Prevents re-triggering the stop arrival when bus lingers near the stop.
   *  Public so the template can keep the e-ticket section visible at an unpaid
   *  arrival (after the bus disappears from the live-buses list). */
  alightStopReached: boolean = false;
  /** Pending payment waiting for Maya popup result. */
  private pendingMayaPayment: { payment: ScannedPayment; fare: number; referenceNumber?: string; checkoutId?: string } | null = null;
  /** Avoid spamming unpaid reminders when approaching the stop. */
  private paymentReminderShown: boolean = false;
  /** True once the selected bus reaches the boarding stop (commuter can board). */
  private boardingStopReached: boolean = false;
  /** Exposed to template so e-ticket can lock the cancel button once boarded */
  get isBoarded(): boolean { return this.boardingStopReached; }
  /** Lock the route picker only when the commuter has actually arrived at their
   *  drop-off without paying. Pre-arrival they can still browse routes (and the
   *  ticket sits dormant on the home tab); locking earlier was firing prematurely
   *  for tickets whose bus hadn't even started its leg yet. */
  get isRouteSelectionLocked(): boolean {
    return this.alightStopReached && !this.paymentCompleted;
  }
  /** True whenever the commuter has any in-flight trip state — booked, paid en-route,
   *  or arrived. Used as the cleanup guard so transient poll misses don't wipe state. */
  private get isTripActive(): boolean {
    return this.showTicket || this.paymentCompleted || this.alightStopReached;
  }
  private paymentNagInterval: any = null;
  private destPaymentReminderShown = false;
  private terminalDepartReminderShown = false;
  /** True once we've notified the commuter they missed the bus at the terminal. */
  private missedBusReminderShown = false;
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
  private readonly SIM_STEP_BASE_KEY = 'commuter_sim_step';

  private getSimStepKey(): string {
    const ticket = this.ticketId || 'unknown';
    return `${this.SIM_STEP_BASE_KEY}_${ticket}`;
  }

  private getTripStateKey(): string {
    try {
      const stored = sessionStorage.getItem('currentUser');
      const id = stored ? JSON.parse(stored)?.id : null;
      return id ? `${this.TRIP_STATE_BASE_KEY}_${id}` : this.TRIP_STATE_BASE_KEY;
    } catch {
      return this.TRIP_STATE_BASE_KEY;
    }
  }

  private buildReturnRouteName(route: LiveRoute): string {
    const start = route.startLocation || '';
    const end = route.endLocation || '';
    if (start && end) return `${end} to ${start}`;
    const name = route.name || '';
    const toSplit = name.split(' to ');
    if (toSplit.length === 2) return `${toSplit[1]} to ${toSplit[0]}`;
    const dashSplit = name.split(' - ');
    if (dashSplit.length === 2) return `${dashSplit[1]} - ${dashSplit[0]}`;
    return `${name} (Return)`;
  }

  private buildRouteOptions(routes: LiveRoute[]): LiveRoute[] {
    const options: LiveRoute[] = [];
    routes.forEach((route) => {
      const baseRouteId = route.baseRouteId ?? String(route.id);
      const baseOption: LiveRoute = {
        ...route,
        id: baseRouteId,
        baseRouteId,
        displayName: route.displayName || route.name,
        isReturnTripOption: false,
      };
      options.push(baseOption);

      const hasReturn =
        (Array.isArray(route.return_stops) && route.return_stops.length > 0) ||
        this.normalizeLineStringGeometry(route.return_map_geometry ?? (route as any).return_geometry) != null;

      if (hasReturn) {
        const returnName = this.buildReturnRouteName(route);
        options.push({
          ...route,
          id: `${baseRouteId}::return`,
          baseRouteId,
          name: returnName,
          displayName: returnName,
          isReturnTripOption: true,
        });
      }
    });

    return options;
  }

  private getSelectedRouteApiId(): string | null {
    if (!this.selectedRoute) return null;
    return this.selectedRoute.baseRouteId ?? this.selectedRoute.id;
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
      boardingRequestId: this.boardingRequestId,
      boardingRequested: this.boardingRequested,
      boardingRequestStopName: this.boardingRequestStopName,
      ticketPersistedToBackend: this.ticketPersistedToBackend,
      alightStopReached: this.alightStopReached,
      completedTripInfo: this.completedTripInfo,
    }));
  }

  private restoreActiveTrip(): void {
    if (!this.routes.length) return;

    const raw = localStorage.getItem(this.getTripStateKey());
    if (raw) {
      try {
        const s = JSON.parse(raw);
        const route = this.routes.find(r => String(r.id) === String(s.selectedRouteId));
        if (route) {
          this.applyTripState(s, route);
          // Reconcile with backend in the background. If the backend has alighted
          // (or never knew about) this ticket — e.g. the driver ended the leg or
          // a Maya webhook flipped payment to paid — sync to the authoritative state
          // so the commuter isn't stuck on a stale local snapshot.
          this.reconcileTripStateWithBackend();
          return;
        }
      } catch {
        localStorage.removeItem(this.getTripStateKey());
      }
    }

    // localStorage empty or route not found — recover from backend
    const commuterId = this.getCommuterId();
    if (!commuterId) {
      this.cancelStaleMyBoardingRequests();
      return;
    }
    this.commuterService.getActiveTicket(commuterId).subscribe({
      next: (res) => {
        if (!res?.ticket) {
          this.cancelStaleMyBoardingRequests();
          return;
        }
        const t = res.ticket;
        const route = this.routes.find(r => String(r.id) === String(t.route_id));
        if (!route) return;
        this.applyTripState({
          selectedRouteId: String(t.route_id),
          ticketId: t.public_ticket_id,
          ticketFare: t.fare,
          showTicket: true,
          paymentCompleted: false,
          selectedScheduleId: t.schedule_id,
          fromStopIndex: t.from_stop_index ?? 0,
          toStopIndex: t.to_stop_index ?? 0,
          ticketDestination: route.name ?? null,
          discountPercent: 0,
          discountAmount: 0,
          ticketOperatorCompany: '',
          ticketBusLabel: '',
          boardingRequestId: null,
          boardingRequested: false,
          boardingRequestStopName: '',
          ticketPersistedToBackend: true,
        }, route);
        this.saveActiveTrip();
      },
      error: () => this.cancelStaleMyBoardingRequests(),
    });
  }

  private applyTripState(s: any, route: any): void {
    this.selectedRouteId = s.selectedRouteId;
    this.selectedRoute = route;
    this.isSelectedBusReturn = !!route.isReturnTripOption;
    this.ticketId = s.ticketId || '';
    this.ticketFare = s.ticketFare ?? null;
    this.showTicket = s.showTicket ?? false;
    this.paymentCompleted = s.paymentCompleted ?? false;
    this.selectedScheduleId = s.selectedScheduleId ?? null;
    const routeStopCount = (route.stops?.length ?? 0);
    this.fromStopIndex = s.fromStopIndex ?? 0;
    this.toStopIndex = (s.toStopIndex != null && s.toStopIndex > 0)
      ? s.toStopIndex
      : Math.max(1, routeStopCount - 1);
    this.ticketDestination = s.ticketDestination ?? null;
    this.discountPercent = s.discountPercent ?? 0;
    this.discountAmount = s.discountAmount ?? 0;
    this.ticketOperatorCompany = s.ticketOperatorCompany || '';
    this.ticketBusLabel = s.ticketBusLabel || '';
    this.boardingRequestId = s.boardingRequestId ?? null;
    this.boardingRequested = s.boardingRequested ?? false;
    this.boardingRequestStopName = s.boardingRequestStopName || '';
    this.ticketPersistedToBackend = s.ticketPersistedToBackend ?? false;
    this.alightStopReached = !!s.alightStopReached;
    if (s.completedTripInfo) {
      this.completedTripInfo = s.completedTripInfo;
    }
    this.syncStopPinsForMap();
    this.updateMapDirectionAssets();
    this.startLiveBusPoll();
    if (this.showTicket) {
      this.startBusSimulation();
    }
  }

  /**
   * Must be a stable array reference — a template getter that returned a new [] every CD
   * caused route-map ngOnChanges to fire endlessly and restart bus interpolation.
   */
  stopPinsForMap: { lng: number; lat: number; label?: string; etaMin?: number }[] = [];
  stopEtas: { name: string; distKm: number; etaMin: number; isPassed: boolean }[] = [];
  etaToMyStop: number | null = null;

  get stopsForSelection(): any[] {
    return this.getStopsForSelection();
  }

  get commuterBoardingPinForMap(): { lng: number; lat: number; label?: string } | null {
    const isStartStop = this.fromStopIndex === 0;
    if (isStartStop) {
      if (this.paymentCompleted) return null;
    } else if (this.boardingStopReached) {
      return null;
    }
    const pin = this.stopPinsForMap[this.fromStopIndex];
    if (!pin || isNaN(pin.lng) || isNaN(pin.lat)) return null;
    return { lng: pin.lng, lat: pin.lat, label: pin.label };
  }

  stopLabel(stop: any, displayIndex: number): string {
    if (stop?.name) return stop.name;
    const baseIndex = typeof stop?.base_index === 'number' ? stop.base_index : null;
    if (typeof baseIndex === 'number') return `Stop ${baseIndex + 1}`;
    const order = stop?.order ?? stop?.stop_order ?? stop?.sequence;
    if (typeof order === 'number') return `Stop ${order}`;
    return `Stop ${displayIndex + 1}`;
  }

  private getStopsForSelection(): any[] {
    return this.mapStopsForRoute.length ? this.mapStopsForRoute : (this.selectedRoute?.stops ?? []);
  }

  private mapStopIndexForApi(displayIndex: number): number {
    const stops = this.getStopsForSelection();
    const stop = stops[displayIndex] as any;
    if (stop && typeof stop.base_index === 'number') return stop.base_index;
    if (this.isSelectedBusReturn) {
      const baseStops = this.selectedRoute?.stops ?? [];
      if (baseStops.length) {
        const mapped = baseStops.length - 1 - displayIndex;
        return Math.max(0, Math.min(baseStops.length - 1, mapped));
      }
    }
    return displayIndex;
  }

  private syncStopPinsForMap(): void {
    const stops = this.getStopsForSelection();
    if (!stops?.length) {
      this.stopPinsForMap = [];
      return;
    }
    this.stopPinsForMap = stops
      .map((s: any, i: number) => {
        const label = this.stopLabel(s, i);
        const eta = this.stopEtas.find(e => e.name === label);
        return {
          lng: Number(s.lng),
          lat: Number(s.lat),
          label,
          etaMin: eta && !eta.isPassed ? eta.etaMin : undefined,
        };
      })
      .filter((p) => Number.isFinite(p.lng) && Number.isFinite(p.lat));
  }

  formatEta(minutes: number): string {
    if (minutes < 60) return `~${minutes} min`;
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m === 0 ? `~${h} hr` : `~${h} hr ${m} min`;
  }

  private haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLng = (lng2 - lng1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }

  private busDistAlongRoute(busLng: number, busLat: number, coords: number[][]): number {
    let bestDist = Infinity;
    let bestDistFromStart = 0;
    let cumDist = 0;
    for (let i = 0; i < coords.length - 1; i++) {
      const [ax, ay] = coords[i];
      const [bx, by] = coords[i + 1];
      const segKm = this.haversineKm(ay, ax, by, bx);
      const dx = bx - ax, dy = by - ay;
      const lenSq = dx * dx + dy * dy;
      const t = lenSq > 0 ? Math.max(0, Math.min(1, ((busLng - ax) * dx + (busLat - ay) * dy) / lenSq)) : 0;
      const d = this.haversineKm(busLat, busLng, ay + t * dy, ax + t * dx);
      if (d < bestDist) {
        bestDist = d;
        bestDistFromStart = cumDist + t * segKm;
      }
      cumDist += segKm;
    }
    return bestDistFromStart;
  }

  private computeStopEtas(): void {
    const bus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
    const coords: number[][] = this.mapRouteGeometry?.coordinates || this.selectedRoute?.geometry?.coordinates;
    const stops = this.getStopsForSelection();

    if (!bus?.position || !Array.isArray(coords) || coords.length < 2 || !stops?.length) {
      this.stopEtas = [];
      this.etaToMyStop = null;
      this.syncStopPinsForMap();
      return;
    }

    const busDistKm = this.busDistAlongRoute(bus.position.lng, bus.position.lat, coords);
    const AVG_KMH = 25;

    this.stopEtas = stops.map((s: any, i: number) => {
      const stopDist = s.distance_km_from_start ?? 0;
      const remaining = Math.max(0, stopDist - busDistKm);
      return {
        name: this.stopLabel(s, i),
        distKm: stopDist,
        etaMin: Math.round(remaining / AVG_KMH * 60),
        isPassed: stopDist < busDistKm - 0.15,
      };
    });

    const myStop = stops[this.fromStopIndex] as any;
    if (myStop) {
      const remaining = Math.max(0, (myStop.distance_km_from_start ?? 0) - busDistKm);
      this.etaToMyStop = Math.round(remaining / AVG_KMH * 60);
    } else {
      this.etaToMyStop = null;
    }

    this.syncStopPinsForMap();
    this.autoAdvanceBoardingStop();
  }

  /** If the bus has passed the commuter's currently-selected Board At stop, advance
   *  to the next available (non-passed, non-last) stop so the selection stays valid.
   *  Special cases:
   *   - Terminal stop (index 0): never auto-shift; surface as missed bus.
   *   - No valid next stop (current is the last intermediate before the destination):
   *     surface as missed bus and cancel the stale boarding request. */
  private autoAdvanceBoardingStop(): void {
    if (this.showTicket || this.paymentCompleted) return; // already booked — don't change
    if (!this.stopEtas.length) return;
    const stops = this.getStopsForSelection();
    if (!stops || stops.length < 2) return;
    if (!this.stopEtas[this.fromStopIndex]?.isPassed) return; // current stop still ahead

    if (this.fromStopIndex === 0) {
      this.notifyMissedBus(
        'The bus has departed the terminal without you. Please wait for the next bus or pick a stop further down the route.'
      );
      return;
    }

    const nextIdx = this.stopEtas.findIndex(
      (e, i) => !e.isPassed && i < stops.length - 1
    );
    if (nextIdx < 0 || nextIdx === this.fromStopIndex) {
      this.notifyMissedBus(
        'The bus has passed your stop and there are no more stops where you can board. Please wait for the next bus.'
      );
      return;
    }

    this.fromStopIndex = nextIdx;
    if (this.toStopIndex <= this.fromStopIndex) {
      this.toStopIndex = Math.min(this.fromStopIndex + 1, stops.length - 1);
    }
    // Re-flag the boarding request against the new stop so the driver's waiting marker moves with us.
    if (this.selectedScheduleId && this.boardingRequested) {
      this.autoFlagForBoarding();
    }
  }

  /** Shared missed-bus handler: popup + clean up the orphaned waiting boarding request. */
  private notifyMissedBus(message: string): void {
    if (this.missedBusReminderShown) return;
    this.missedBusReminderShown = true;
    void this.presentBusArrivedAlert('You Missed the Bus', message);
    if (this.boardingRequestId) {
      this.commuterService.cancelBoardingRequest(this.boardingRequestId).subscribe({ error: () => {} });
      this.boardingRequestId = null;
      this.boardingRequested = false;
      this.boardingRequestStopName = '';
      this.saveActiveTrip();
    }
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

  private updateSelectedBusDirection(): void {
    if (this.selectedScheduleId == null) {
      this.isSelectedBusReturn = !!this.selectedRoute?.isReturnTripOption;
      return;
    }
    const bus = this.liveBuses.find((b) => b.schedule_id === this.selectedScheduleId);
    this.isSelectedBusReturn = !!bus?.is_return_trip;
  }

  private updateMapDirectionAssets(): void {
    const route = this.selectedRoute;
    if (!route) {
      this.mapRouteGeometry = null;
      this.mapStopsForRoute = [];
      this.syncStopPinsForMap();
      return;
    }

    const baseGeom = this.normalizeLineStringGeometry(route.geometry);
    const returnGeom = this.normalizeLineStringGeometry(
      (route as any).return_map_geometry ?? (route as any).return_geometry
    );

    if (this.isSelectedBusReturn) {
      if (returnGeom) {
        this.mapRouteGeometry = returnGeom;
      } else if (baseGeom) {
        this.mapRouteGeometry = {
          type: 'LineString',
          coordinates: [...baseGeom.coordinates].reverse().map((c) => [Number(c[0]), Number(c[1])])
        };
      } else {
        this.mapRouteGeometry = null;
      }
    } else {
      this.mapRouteGeometry = baseGeom;
    }

    const baseStops = (route.stops || []).map((s: any, i: number) => ({
      ...s,
      base_index: i,
    }));
    const returnStops = (route as any).return_stops || [];
    const rawStops = this.isSelectedBusReturn
      ? (returnStops.length ? returnStops : [...baseStops].reverse())
      : baseStops;

    const totalKm = Number(route.distance_km ?? 0);
    this.mapStopsForRoute = rawStops.map((s: any) => {
      const dist = s?.distance_km_from_start;
      const baseIndex = typeof s?.base_index === 'number' ? s.base_index : undefined;
      if (this.isSelectedBusReturn && typeof dist === 'number' && totalKm > 0) {
        return { ...s, base_index: baseIndex, distance_km_from_start: Math.max(0, totalKm - dist) };
      }
      return { ...s, base_index: baseIndex };
    });

    this.syncStopPinsForMap();
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
    this.mapRouteGeometry = null;
    this.mapStopsForRoute = [];
    this.isSelectedBusReturn = false;
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
      this.routes = this.buildRouteOptions(routes);
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
      this.mapRouteGeometry = null;
      this.mapStopsForRoute = [];
      this.isSelectedBusReturn = false;
      this.boardingStopReached = false;
      this.ticketOperatorCompany = '';
      this.ticketBusLabel = '';
      this.discountAmount = 0;
      this.syncStopPinsForMap();
      return;
    }

    this.stopPaymentNag();
    this.paymentCompleted = false;
    this.paymentReminderShown = false;
    this.destPaymentReminderShown = false;
    this.terminalDepartReminderShown = false;
    this.missedBusReminderShown = false;
    this.alightStopReached = false;
    this.alightNotified = false;
    this.boardingStopReached = false;
    this.resetBoardingRequest();
    // pick from cache (ion-select may use string or number id)
    const sid = String(this.selectedRouteId);
    this.selectedRoute = this.routes.find((route) => String(route.id) === sid) || null;
    this.isSelectedBusReturn = !!this.selectedRoute?.isReturnTripOption;
    console.log('Selected route:', this.selectedRoute);
    this.syncStopPinsForMap();
    this.updateMapDirectionAssets();

    if (!this.selectedRoute) return;

    const normalized = this.normalizeLineStringGeometry(this.selectedRoute.geometry);
    if (normalized) {
      this.selectedRoute.geometry = normalized;
    }
    this.updateMapDirectionAssets();

    this.stopChoice = 'terminus';
    this.selectedScheduleId = null;
    this.stopLiveBusPoll();
    this.startLiveBusPoll();

    try {
      this.ticketDestination = this.selectedRoute.name || null;

      const stops = this.getStopsForSelection();
      if (stops && stops.length >= 2) {
        this.fromStopIndex = 0;
        this.toStopIndex = stops.length - 1;
        this.ticketFare = null;
        this.discountPercent = 0;
        this.discountAmount = 0;
        this.ticketPersistedToBackend = false;
        this.ticketId = this.generateTicketId();
        this.applySegmentFare();
        return;
      }

      if (stops && stops.length === 1) {
        this.ticketFare = null;
        this.discountPercent = 0;
        this.discountAmount = 0;
        this.ticketPersistedToBackend = false;
        this.ticketId = this.generateTicketId();
        this.applyFareForStopChoice();
        return;
      }

      const passengerType = this.commuterService.getPassengerType();
      const apiRouteId = this.getSelectedRouteApiId();
      if (!apiRouteId) return;
      this.commuterService.calculateFareWithDiscount(apiRouteId, passengerType).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.ticketFare = response.data.final_fare;
            this.discountPercent = response.data.discount_percent || 0;
            this.discountAmount = response.data.discount_amount || 0;
          }
          this.ticketPersistedToBackend = false;
          this.ticketId = this.generateTicketId();
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare || 0;
          this.ticketPersistedToBackend = false;
          this.ticketId = this.generateTicketId();
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
    const stops = this.getStopsForSelection();
    if (!stops.length) return;
    this.boardingStopReached = false;
    this.missedBusReminderShown = false;
    const max = stops.length - 1;
    if (this.fromStopIndex < 0) this.fromStopIndex = 0;
    if (this.fromStopIndex > max) this.fromStopIndex = max;
    if (this.toStopIndex < 0) this.toStopIndex = 0;
    if (this.toStopIndex > max) this.toStopIndex = max;
    // If same stop selected for both, pick the nearest valid neighbour
    if (this.fromStopIndex === this.toStopIndex) {
      this.toStopIndex = this.fromStopIndex > 0
        ? this.fromStopIndex - 1
        : Math.min(max, this.fromStopIndex + 1);
    }
    this.applySegmentFare();
    if (this.selectedScheduleId) {
      this.autoFlagForBoarding();
    }
  }

  private applySegmentFare() {
    const stops = this.getStopsForSelection();
    if (!stops.length || stops.length < 2) return;
    const mappedFrom = this.mapStopIndexForApi(this.fromStopIndex);
    const mappedTo = this.mapStopIndexForApi(this.toStopIndex);
    // API always wants the lower index as from and higher as to (direction-agnostic fare calc)
    const apiFrom = Math.min(mappedFrom, mappedTo);
    const apiTo = Math.max(mappedFrom, mappedTo);
    const approvalId = this.selectedRoute?.approval_request_id;
    this.commuterService
      .fareSegment({
        route_id: parseInt(this.getSelectedRouteApiId() || '0', 10),
        from_stop_index: apiFrom,
        to_stop_index: apiTo,
        approval_request_id: approvalId,
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.ticketFare = res.data.final_fare;
            this.discountPercent = res.data.discount_percent || 0;
            this.discountAmount = res.data.discount_amount || 0;
            const from = stops[this.fromStopIndex];
            const to = stops[this.toStopIndex];
            const fromLabel = from?.name || this.stopLabel(from, this.fromStopIndex);
            const toLabel = to?.name || this.stopLabel(to, this.toStopIndex);
            this.ticketDestination = `${fromLabel || 'Boarding'} → ${toLabel || 'Alighting'}`;
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
    const apiRouteId = this.getSelectedRouteApiId();
    if (!apiRouteId) {
      this.liveBuses = [];
      this.liveBusMapPins = [];
      return;
    }
    const direction: 'outbound' | 'return' = this.selectedRoute?.isReturnTripOption ? 'return' : 'outbound';
    this.commuterService.getLiveBuses(String(apiRouteId), this.commuterTerminal, direction).subscribe({
      next: (res) => {
        if (!res.success || !Array.isArray(res.buses)) {
          this.liveBuses = [];
          this.liveBusMapPins = [];
          this.selectedScheduleId = null;
          return;
        }
        this.liveBuses = res.buses;
        this.updateLiveBusMapPins();
        this.updateSelectedBusDirection();
        this.updateMapDirectionAssets();
        this.checkBoardingFromLivePosition();
        if (
          this.selectedScheduleId != null &&
          !this.liveBuses.some((b) => b.schedule_id === this.selectedScheduleId) &&
          !this.isTripActive
        ) {
          // Only clear the selection when no active trip state remains. isTripActive
          // covers all three failure modes that previously caused silent wipes:
          //   - en-route booked unpaid (showTicket=true)
          //   - paid mid-trip (paymentCompleted=true, showTicket=false)
          //   - arrived unpaid (alightStopReached=true)
          this.selectedScheduleId = null;
          this.updateSelectedBusDirection();
          this.updateMapDirectionAssets();
          this.boardingStopReached = false;
          this.updateLiveBusMapPins();
          this.saveActiveTrip();
        }
        this.autoSelectSingleLiveBus();
        this.computeStopEtas();
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
    this.showTicket = true;
    this.updateLiveBusMapPins();
    this.updateSelectedBusDirection();
    this.updateMapDirectionAssets();
    this.syncTicketBusLabelsForETicket();
    this.saveInProgressTripSnapshot(this.ticketFare ?? this.selectedRoute?.basefare ?? 0);
    this.saveActiveTrip();
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
    this.showTicket = true;
    this.boardingStopReached = false;
    this.missedBusReminderShown = false;
    this.updateLiveBusMapPins();
    this.updateSelectedBusDirection();
    this.updateMapDirectionAssets();
    this.computeStopEtas();
    this.syncTicketBusLabelsForETicket();
    this.saveInProgressTripSnapshot(this.ticketFare ?? this.selectedRoute?.basefare ?? 0);
    this.saveActiveTrip();
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
    const stops = this.getStopsForSelection();
    if (!stops.length) return;

    let idx = stops.length - 1;
    if (this.stopChoice !== 'terminus' && this.stopChoice !== '') {
      const n = typeof this.stopChoice === 'string' ? parseInt(this.stopChoice, 10) : Number(this.stopChoice);
      if (!Number.isNaN(n)) idx = n;
    }

    const apiIndex = this.mapStopIndexForApi(idx);

    this.commuterService
      .previewFareAtStop(
        this.getSelectedRouteApiId() || this.selectedRoute!.id,
        apiIndex,
        this.selectedRoute!.approval_request_id
      )
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.fare != null) {
            this.ticketFare = res.data.fare;
            const stop = stops[idx];
            const label = stop?.name || this.stopLabel(stop, idx);
            this.ticketDestination = `${this.selectedRoute!.name} → ${label}`;
          }
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare ?? 0;
        },
      });
  }

  private autoFlagForBoarding(): void {
    if (!this.selectedRoute || !this.selectedScheduleId) return;
    // Once a ticket has been persisted, the commuter is on the driver manifest via
    // the ticket itself — they don't need (and must NOT have) a separate "waiting"
    // boarding-request row. Creating one here after booking was the source of the
    // phantom purple marker that lingered even though the commuter was aboard.
    if (this.ticketPersistedToBackend) return;
    const stops = this.getStopsForSelection();
    if (stops && stops.length >= 2 && this.fromStopIndex === this.toStopIndex) return;

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
      route_id: parseInt(this.getSelectedRouteApiId() || '0', 10),
      from_stop_index: this.mapStopIndexForApi(this.fromStopIndex),
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
          const stop = stops[this.fromStopIndex];
          this.boardingRequestStopName = res.boarding_stop_name || stop?.name || this.stopLabel(stop, this.fromStopIndex) || 'your stop';
          this.saveActiveTrip();
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
    
    const apiRouteId = this.getSelectedRouteApiId();
    if (!apiRouteId) return;
    this.commuterService.calculateFareWithDiscount(
      apiRouteId,
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

  /** Blocking popup shown when the live bus reaches the commuter's boarding or drop-off stop. */
  private async presentBusArrivedAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      backdropDismiss: false,
      buttons: [{ text: 'OK', role: 'cancel' }],
    });
    await alert.present();
  }

  /** Confirm route, fare, and payment before calling the booking APIs. */
  async confirmBeforeGetETicket() {
    if (!this.selectedRoute) return;

    if (this.liveBuses.length === 0) {
      void this.showToast('No active driver for this route. Please wait for a driver to accept a schedule.', 'warning');
      return;
    }

    if (this.liveBuses.length > 0 && this.selectedScheduleId == null) {
      void this.showToast('Select an active bus for this route first.', 'warning');
      return;
    }

    const stops = this.getStopsForSelection();
    if (stops && stops.length >= 2 && this.fromStopIndex === this.toStopIndex) {
      void this.showToast('Boarding stop and alighting stop cannot be the same.', 'warning');
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

    if (this.liveBuses.length === 0) {
      void this.showToast('No active driver for this route. Please wait for a driver to accept a schedule.', 'warning');
      return;
    }

    if (this.liveBuses.length > 0 && this.selectedScheduleId == null) {
      const first = this.liveBuses.find(b => !b.is_full);
      if (first) {
        this.selectLiveBus(first);
      }
    }

    const stops = this.getStopsForSelection();
    if (stops && stops.length >= 2 && this.fromStopIndex === this.toStopIndex) {
      void this.showToast('Boarding stop and alighting stop cannot be the same.', 'warning');
      return;
    }

    const passengerType = this.commuterService.getPassengerType();

    if (stops && stops.length >= 2) {
      const mappedFrom = this.mapStopIndexForApi(this.fromStopIndex);
      const mappedTo = this.mapStopIndexForApi(this.toStopIndex);
      const apiFrom = Math.min(mappedFrom, mappedTo);
      const apiTo = Math.max(mappedFrom, mappedTo);
      this.commuterService
        .fareSegment({
          route_id: parseInt(this.getSelectedRouteApiId() || '0', 10),
          from_stop_index: apiFrom,
          to_stop_index: apiTo,
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
    const apiRouteId = this.getSelectedRouteApiId();
    if (!apiRouteId) return;
    this.commuterService.calculateFareWithDiscount(apiRouteId, passengerType).subscribe({
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
    this.commuterService.alight(this.ticketId, this.getCommuterId()).subscribe({
      error: (err) => console.warn('alight request failed', err),
    });
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
    this.ticketPersistedToBackend = false;
    this.commuterService
      .bookTicket({
        route_id: parseInt(route.id, 10),
        schedule_id: this.selectedScheduleId ?? undefined,
        public_ticket_id: this.ticketId,
        fare: finalFare,
        commuter_id: this.getCommuterId(),
        payment_method: this.paymentMethod,
        from_stop_index: this.fromStopIndex,
        to_stop_index: this.toStopIndex,
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
          this.ticketPersistedToBackend = true;
          // Clear the "waiting at stop" frontend state — the backend just transitioned
          // any matching BoardingRequest from 'waiting' to 'boarded' inside bookTicket(),
          // and the commuter is now on the manifest via the ticket itself. Leaving the
          // flag set would keep the chip + driver's purple marker active.
          this.boardingRequested = false;
          this.boardingRequestId = null;
          this.boardingRequestStopName = '';
          this.boardingReqInFlight = false;
          this.boardingReqPendingRetry = false;
          this.syncTicketBusLabelsForETicket();
          this.saveInProgressTripSnapshot(finalFare);
          this.showTicket = true;
          this.saveActiveTrip();
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
    const selectedType = this.paymentMethod || 'cash';
    let chosenMethod = defaultMethod;

    if (selectedType !== 'cash') {
      chosenMethod = methods.find(m => m.type === selectedType)
        ?? (defaultMethod?.type === selectedType ? defaultMethod : { type: selectedType, number: '', name: selectedType });
    } else {
      chosenMethod = { type: 'cash' };
    }

    const fare = payment.fareOverride ?? this.ticketFare ?? this.selectedRoute?.basefare ?? 0;
    const fareDisplay = `₱${(+fare).toFixed(2)}`;

    let paymentLine: string;
    let balanceLine = '';

    if (chosenMethod && chosenMethod.type !== 'cash') {
      const label = chosenMethod.type === 'gcash' ? 'GCash' : 'PayMaya';
      const masked = chosenMethod.number?.replace(/\d(?=\d{4})/g, '•') ?? '';
      paymentLine = `${label} ${masked}`;
      if (chosenMethod.type !== 'paymaya' && chosenMethod.number) {
        try {
          const bal = await this.paymentService.getEWalletBalance(chosenMethod.number);
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
        { text: 'Confirm & Board', handler: () => this.finalizePayment(payment, chosenMethod, fare) }
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
    // Open the popup synchronously inside the user gesture; navigate it later
    // once we have the Maya checkout URL (avoids browser popup blocking).
    const popup = window.open('', 'maya_payment', 'width=520,height=680,left=200,top=100');

    if (!popup || popup.closed) {
      void this.showToast('Popup blocked. Please allow popups for this site and try again.', 'warning');
      return;
    }

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
      popup.close();
      console.error('[PayMaya] Failed to get checkout URL:', result);
      void this.showToast(result.message ?? 'Could not start Maya payment.', 'danger');
      return;
    }

    localStorage.setItem('transittrack_app_origin', window.location.origin);

    const ticketRef = payment.ticketIdOverride || this.ticketId;
    const checkoutId = result.checkout_id;
    const referenceNumber = result.reference_number;

    this.pendingMayaPayment = { payment, fare, referenceNumber, checkoutId };

    // ─────────────────────────────────────────────────────────────────────
    // Single-resolve pattern: three potential success/failure signals
    // (postMessage, popup-closed poll + localStorage / backend / Maya query)
    // race each other. Only the first wins; the rest see `resolved` and exit.
    // This kills the bug where postMessage said success but the poll had
    // already cleared `pendingMayaPayment` and showed the failure alert.
    // ─────────────────────────────────────────────────────────────────────
    let resolved = false;
    let pollInterval: ReturnType<typeof setInterval> | null = null;

    const cleanup = () => {
      if (this.mayaMessageHandler) {
        window.removeEventListener('message', this.mayaMessageHandler);
        this.mayaMessageHandler = null;
      }
      if (pollInterval !== null) {
        clearInterval(pollInterval);
        pollInterval = null;
      }
    };

    const resolveSuccess = async (source: string) => {
      if (resolved) return;
      resolved = true;
      console.log('[PayMaya] resolved success via', source);
      cleanup();
      const pending = this.pendingMayaPayment ?? { payment, fare, referenceNumber, checkoutId };
      this.pendingMayaPayment = null;
      await this.completeBooking(pending.payment, 'paymaya', pending.fare, pending.referenceNumber ?? null);
    };

    const resolveFailure = (reason: 'cancelled' | 'failed', source: string) => {
      if (resolved) return;
      resolved = true;
      console.log('[PayMaya] resolved failure via', source, 'reason:', reason);
      cleanup();
      this.pendingMayaPayment = null;
      if (reason === 'cancelled') {
        void this.showPaymentFailedAlert(
          'Payment cancelled',
          'Your PayMaya payment was cancelled. You can try again or choose a different payment method.'
        );
      } else {
        void this.showPaymentFailedAlert(
          'Payment not completed',
          'Your PayMaya payment could not be processed. This is usually due to insufficient balance — please top up your account and try again, or choose a different payment method.'
        );
      }
    };

    // Two-stage reconciliation: ask our backend first (cheap, fast). If our DB
    // hasn't been updated (the success callback never reached us — common when
    // APP_URL is wrong or the user closed the popup before the redirect fired),
    // ask Maya directly via the checkout-status endpoint, which also flips
    // our DB if Maya reports paid.
    const verifyOrQueryMaya = async (): Promise<boolean> => {
      if (await this.verifyMayaPaymentSettled(ticketRef)) return true;
      if (!checkoutId) return false;
      const status = await this.paymentService.getMayaCheckoutStatus(checkoutId);
      return status.paid;
    };

    // Drop any stale handler from a previous attempt, then install ours.
    if (this.mayaMessageHandler) {
      window.removeEventListener('message', this.mayaMessageHandler);
    }
    this.mayaMessageHandler = (event: MessageEvent) => {
      if (event.data?.type !== 'MAYA_PAYMENT_RESULT') return;
      const { status } = event.data;
      this.ngZone.run(async () => {
        if (status === 'success') {
          await resolveSuccess('postMessage:success');
        } else if (status === 'cancelled') {
          resolveFailure('cancelled', 'postMessage:cancelled');
        } else {
          // 'failed' / unknown — still verify with backend + Maya before declaring failure.
          if (await verifyOrQueryMaya()) {
            await resolveSuccess('postMessage:failed→verify');
          } else {
            resolveFailure('failed', 'postMessage:failed');
          }
        }
      });
    };
    window.addEventListener('message', this.mayaMessageHandler);

    console.log('[PayMaya] Navigating popup to:', result.checkout_url);
    popup.location.href = result.checkout_url;

    // Poll for popup close. We don't tear down the postMessage handler here —
    // it stays alive so a slightly-late success message can still win.
    pollInterval = setInterval(() => {
      if (!popup.closed || resolved) return;

      // 2.5s grace gives postMessage / Maya's webhook / our success endpoint
      // time to land before we resort to verify+Maya-query.
      setTimeout(async () => {
        if (resolved) return;

        const paidTicket = localStorage.getItem('maya_paid_ticket');
        if (paidTicket === ticketRef) {
          localStorage.removeItem('maya_paid_ticket');
          await resolveSuccess('poll:localStorage');
          return;
        }

        if (await verifyOrQueryMaya()) {
          await resolveSuccess('poll:verify');
        } else {
          resolveFailure('failed', 'poll:verify-failed');
        }
      }, 2500);
    }, 800);
  }

  /**
   * Last-chance check after the Maya popup closes: ask the backend whether this ticket
   * actually settled. Closes the race where Maya succeeded but postMessage / localStorage
   * never reached the parent before the failure alert would fire.
   */
  /**
   * After applying localStorage trip state, reconcile with the backend.
   *   - If the backend has no active ticket (or a different one) for this commuter,
   *     wipe local state — the trip ended somewhere else (driver completed the leg,
   *     ticket was force-alighted, etc.) and we shouldn't keep the stale home-tab UI.
   *   - If the backend says payment_status is paid but locally we still think it's
   *     unpaid (e.g. a Maya webhook landed between sessions), sync the flag so the
   *     route picker unlocks and the trip can complete normally.
   */
  private reconcileTripStateWithBackend(): void {
    if (!this.ticketId) return;
    const commuterId = this.getCommuterId();
    if (!commuterId) return;

    this.commuterService.getActiveTicket(commuterId).subscribe({
      next: (res) => {
        const t = res?.ticket;
        if (!t || t.public_ticket_id !== this.ticketId) {
          // Backend doesn't recognize this trip anymore — clear without firing the rating flow.
          this.completePostArrivalCleanup({ silent: true });
          return;
        }
        if (t.payment_status === 'paid' && !this.paymentCompleted) {
          // Payment landed out-of-band — adopt it so the lock lifts.
          this.paymentCompleted = true;
          if (this.alightStopReached) {
            setTimeout(() => this.completePostArrivalCleanup(), 1500);
          } else {
            this.showTicket = false;
          }
          this.saveActiveTrip();
        }
      },
      error: () => { /* backend unreachable — keep local snapshot */ },
    });
  }

  private verifyMayaPaymentSettled(ticketRef: string): Promise<boolean> {
    return new Promise((resolve) => {
      const commuterId = this.getCommuterId();
      if (!commuterId || !ticketRef) {
        resolve(false);
        return;
      }
      this.commuterService.getActiveTicket(commuterId).subscribe({
        next: (res) => {
          const t = res?.ticket;
          resolve(!!(t && t.public_ticket_id === ticketRef && t.payment_status === 'paid'));
        },
        error: () => resolve(false),
      });
    });
  }

  private async showPaymentFailedAlert(header: string, message: string): Promise<void> {
    const alert = await this.alertController.create({
      header,
      message,
      buttons: [
        { text: 'Try Again', role: 'cancel' },
        {
          text: 'Change Payment Method',
          handler: () => { this.showQrScanner = true; },
        },
      ],
    });
    await alert.present();
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
    if (!this.ticketPersistedToBackend) {
      this.commuterService.bookTicket({
        route_id: payment.routeId || parseInt(this.selectedRoute?.id ?? '0', 10),
        schedule_id: payment.scheduleId || undefined,
        fare,
        public_ticket_id: ticketId,
        payment_method: methodType,
        commuter_id: JSON.parse(sessionStorage.getItem('currentUser') || '{}').id ?? undefined,
        from_stop_index: this.fromStopIndex,
        to_stop_index: this.toStopIndex,
      }).subscribe();
    }

    // Mark the ticket as paid on the backend so the driver manifest reflects it
    if (ticketId && methodType !== 'cash') {
      this.commuterService.markTicketPaid(ticketId, methodType, this.getCommuterId()).subscribe({
        error: (err) => console.warn('markTicketPaid failed', err)
      });
    }

    if (ticketId) {
      const txRef = transactionId || ('TT-' + ticketId.slice(-10).toUpperCase());
      this.tripHistoryService.updateLocalTrip(ticketId, { status: 'paid', paymentMethod: methodType, transactionRef: txRef });

      // Save receipt to localStorage for display in Trip History
      const receipt = {
        ticketId,
        fare,
        paymentMethod: methodType === 'paymaya' ? 'PayMaya' : methodType === 'gcash' ? 'GCash' : methodType === 'card' ? 'Card' : 'Cash',
        routeName: this.selectedRoute?.name || '',
        paidAt: new Date().toISOString(),
        transactionRef: txRef,
      };
      localStorage.setItem(`receipt_${ticketId}`, JSON.stringify(receipt));
    }

    // Auto-save PayMaya as default payment method after first successful PayMaya payment
    if (methodType === 'paymaya') {
      const cu = JSON.parse(sessionStorage.getItem('currentUser') || '{}');
      const uid = cu.id || '';
      if (uid) {
        const existing: any[] = JSON.parse(localStorage.getItem(`paymentMethods_${uid}`) || '[]');
        existing.forEach((m: any) => m.isDefault = false);
        const pm = existing.find((m: any) => m.type === 'paymaya');
        if (pm) {
          pm.isDefault = true;
        } else {
          existing.push({ type: 'paymaya', number: '', name: 'PayMaya', isDefault: true });
        }
        localStorage.setItem(`paymentMethods_${uid}`, JSON.stringify(existing));
      }
    }

    this.stopPaymentNag();
    this.paymentCompleted = true;
    this.paymentReminderShown = false;
    this.saveActiveTrip(); // persist so refresh doesn't re-show the payment screen

    const label = methodType === 'card' ? 'Card' : methodType === 'gcash' ? 'GCash' : methodType === 'paymaya' ? 'PayMaya' : 'Cash';
    void this.showToast(`Payment confirmed via ${label}. Check Trip History for your receipt.`, 'success');

    // If the commuter already arrived at their drop-off but couldn't proceed because
    // the trip was unpaid, run the post-arrival cleanup now that payment cleared.
    // (ticketId is kept above so notifyAlighted() inside the cleanup still has a value.)
    if (this.alightStopReached) {
      setTimeout(() => this.completePostArrivalCleanup(), 1500);
      return;
    }

    // Paid mid-trip — hide the e-ticket card; route/map stay visible until drop-off.
    this.showTicket = false;
  }

  async closeTicket() {
    if (!this.ensurePaymentBeforeAlight()) {
      return;
    }
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

  private ensurePaymentBeforeAlight(): boolean {
    if (this.paymentCompleted) {
      return true;
    }

    if (this.paymentReminderShown) {
      return false;
    }
    this.paymentReminderShown = true;

    const method = this.getPaymentMethodLabel();
    void this.showToast(`Please complete ${method} payment before ending your trip.`, 'warning');
    if (this.paymentMethod === 'paymaya' || this.paymentMethod === 'gcash') {
      this.showQrScanner = true;
    }
    return false;
  }

  /** Completes local trip + notifies operator; call when commuter confirms they have alighted. */
  private finalizeTripFromTicket(): void {
    const bus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
    // Use getStopsForSelection() so return-trip commuters get the reversed/return stop list
    // — selectedRoute.stops is always the outbound order and would mislabel both ends.
    const displayStops = this.getStopsForSelection();
    this.completedTripInfo = {
      routeName: this.selectedRoute?.name || '',
      fare: this.ticketFare ?? this.selectedRoute?.basefare ?? 0,
      driverName: bus?.driver_name || 'Your Driver',
      scheduleId: this.selectedScheduleId,
      ticketId: this.ticketId,
      boardStopName: displayStops?.[this.fromStopIndex]?.name || '',
      alightStopName: displayStops?.[this.toStopIndex]?.name || '',
    };

    this.resetBoardingRequest();
    this.stopPaymentNag();
    this.destPaymentReminderShown = false;
    this.terminalDepartReminderShown = false;
    this.missedBusReminderShown = false;
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

    const saved = sessionStorage.getItem(this.getSimStepKey());
    const savedStep = saved !== null ? parseInt(saved, 10) : -1;
    const startIdx = savedStep >= 0 && savedStep < coords.length ? savedStep : 0;

    const lastIdx = coords.length - 1;

    // If the sim already reached the end, keep the position at the final coordinate.
    if (savedStep >= lastIdx) {
      const lastCoord = coords[lastIdx];
      this.boardingLocation = { lng: Number(lastCoord[0]), lat: Number(lastCoord[1]) };
      this.currentBusPosition = { ...this.boardingLocation };
      this.distanceTraveled = this.selectedRoute.distance_km || 0;
      this.isSimulationActive = false;
      return;
    }

    // Set boarding location as the saved or first coordinate
    const firstCoord = coords[startIdx];
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
      .simulateAlongLine(coords, 2000, startIdx)
      .subscribe({
        next: (position) => {
          if (!position || isNaN(position.lng) || isNaN(position.lat)) return;
          this.currentBusPosition = { lng: position.lng, lat: position.lat };
          if (totalDistance > 0 && totalSteps > 0) {
            this.distanceTraveled = totalDistance * (position.index / totalSteps);
          }
          sessionStorage.setItem(this.getSimStepKey(), String(position.index));
        },
        complete: () => {
          sessionStorage.setItem(this.getSimStepKey(), String(lastIdx));
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

    // CRITICAL: use the displayed stop list (which is reversed for return-trip selections),
    // NOT selectedRoute.stops (always outbound order). Otherwise a commuter on a return
    // option ("Liloan → Cebu") with drop-off = Cebu would resolve to Liloan instead, and
    // the bus sitting at Liloan (pre-return-leg start) would fire a false "arrived" popup.
    const displayStops = this.getStopsForSelection();
    const destStop = displayStops?.[this.toStopIndex];
    if (!destStop) return;
    const dLng = Number(destStop.lng), dLat = Number(destStop.lat);
    if (isNaN(dLng) || isNaN(dLat)) return;

    const selectedBus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
    if (!selectedBus?.position) return;

    // Don't fire arrival logic until the bus's leg is actually active. A schedule that
    // just finished its outbound leg sits at the terminus with status='active' but
    // leg_status='pending' until the driver taps Start Return Trip — its reported
    // position is stale (the terminus) and would trigger spurious "near destination" /
    // "arrived" popups for commuters whose ticket was for the still-not-started leg.
    if ((selectedBus.leg_status ?? 'pending') !== 'active') return;

    const dist = new mapboxgl.LngLat(selectedBus.position.lng, selectedBus.position.lat)
      .distanceTo(new mapboxgl.LngLat(dLng, dLat));

    // Proactive payment reminder ~1 km before destination
    if (!this.paymentCompleted && !this.destPaymentReminderShown && dist <= 1000) {
      this.destPaymentReminderShown = true;
      void this.showToast('You are near your destination. Please complete your fare payment now.', 'warning');
      this.startPaymentNag();
    }

    if (dist > 500) return; // bus still en route

    // Within 500m — bus has arrived at the commuter's drop-off stop
    this.alightStopReached = true;

    const arrivedBus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
    this.completedTripInfo = {
      routeName: this.selectedRoute?.name || '',
      fare: this.ticketFare ?? this.selectedRoute?.basefare ?? 0,
      driverName: arrivedBus?.driver_name || 'Your Driver',
      scheduleId: this.selectedScheduleId,
      ticketId: this.ticketId,
      boardStopName: displayStops?.[this.fromStopIndex]?.name || '',
      alightStopName: displayStops?.[this.toStopIndex]?.name || '',
    };

    this.stopLiveBusPoll();
    const dropName = this.completedTripInfo.alightStopName || 'your destination';

    if (!this.paymentCompleted) {
      // UNPAID arrival: keep the e-ticket on the home tab, lock the route picker,
      // and persist the arrived state so it survives a refresh. The trip ends only
      // when the commuter pays — completeBooking() will then run completePostArrivalCleanup().
      void this.presentBusArrivedAlert(
        'Arrived — Payment Required',
        `The bus has reached ${dropName}. Please complete your fare payment now. You cannot book another trip until this ticket is paid.`
      );
      this.startPaymentNag();
      this.saveActiveTrip();
      return;
    }

    // PAID arrival: standard post-trip flow.
    void this.presentBusArrivedAlert(
      'Arrived at Your Destination',
      `The bus has arrived at ${dropName}. Please prepare to alight.`
    );
    setTimeout(() => this.completePostArrivalCleanup(), 5000);
  }

  /** Tear down the active trip after a paid arrival. Triggered either by the 5-second
   *  delay after arrival, or by completeBooking() once a delayed payment lands.
   *  Mirrors finalizeTripFromTicket() so both code paths leave state in the same
   *  shape — otherwise leftover flags from this path break the next trip. */
  private completePostArrivalCleanup(options: { silent?: boolean } = {}): void {
    const arrivedTicketId = this.ticketId;
    this.notifyAlighted();
    if (!options.silent) {
      void this.showToast('You have arrived at your stop. Have a safe trip!', 'success');
    }
    if (arrivedTicketId) {
      const arrived = new Date().toISOString();
      this.tripHistoryService.updateLocalTrip(arrivedTicketId, {
        status: 'completed',
        arrivalTime: arrived,
        duration: this.computeTripDurationLabel(arrived),
      });
    }
    this.resetBoardingRequest();
    this.stopPaymentNag();
    this.stopLiveBusPoll();
    this.stopBusSimulation();
    this.showTicket = false;
    this.paymentCompleted = false;
    this.paymentReminderShown = false;
    this.destPaymentReminderShown = false;
    this.terminalDepartReminderShown = false;
    this.missedBusReminderShown = false;
    this.boardingStopReached = false;
    this.selectedRoute = null;
    this.selectedRouteId = '';
    this.ticketFare = null;
    this.ticketId = '';
    this.ticketPersistedToBackend = false;
    this.alightStopReached = false;
    this.alightNotified = false;
    this.liveBuses = [];
    this.liveBusMapPins = [];
    this.syncStopPinsForMap();
    localStorage.removeItem(this.getTripStateKey());
    this.selectedRating = 0;
    this.ratingComment = '';
    if (!options.silent) {
      this.showRatingModal = true;
    }
  }

  /** Called after each live bus poll to check if the selected bus has reached the boarding stop. */
  private checkBoardingFromLivePosition(): void {
    if (this.boardingStopReached) return;
    if (!this.selectedScheduleId) return;

    // Terminal passengers (fromStopIndex===0) are already at the bus —
    // no arrival popup needed; payment reminders are handled near drop-off.
    if (this.fromStopIndex === 0) {
      return;
    }

    const stops = this.getStopsForSelection();
    const boardStop = stops[this.fromStopIndex];
    if (!boardStop) return;
    const bLng = Number(boardStop.lng), bLat = Number(boardStop.lat);
    if (isNaN(bLng) || isNaN(bLat)) return;

    const selectedBus = this.liveBuses.find(b => b.schedule_id === this.selectedScheduleId);
    if (!selectedBus?.position) return;

    // Only fire boarding arrival when the leg is actually active. Otherwise a bus
    // sitting at the terminus between legs would falsely trigger "bus arrived"
    // for any commuter whose ticket points to a stop near that idle position.
    if ((selectedBus.leg_status ?? 'pending') !== 'active') return;

    const dist = new mapboxgl.LngLat(selectedBus.position.lng, selectedBus.position.lat)
      .distanceTo(new mapboxgl.LngLat(bLng, bLat));

    if (dist <= 500) {
      this.boardingStopReached = true;
      const stopName = boardStop?.name || this.stopLabel(boardStop, this.fromStopIndex) || 'your stop';
      if (this.showTicket) {
        // Booked ticket — they're already on the manifest, just need to physically board.
        void this.presentBusArrivedAlert(
          'Your Bus Has Arrived',
          `The bus has arrived at ${stopName}. Please board now.`
        );
      } else {
        // No ticket yet — the boarding request alone won't put them on the driver's aboard list.
        // Prompt them to tap "Get E-Ticket" before the bus leaves.
        void this.presentBusArrivedAlert(
          'Your Bus Has Arrived',
          `The bus has arrived at ${stopName}. Tap "Get E-Ticket" now to book before it leaves.`
        );
      }
    }
  }

  /** Start a recurring 60-second payment reminder while the commuter is onboard and unpaid. */
  private startPaymentNag(): void {
    if (this.paymentNagInterval || this.paymentCompleted) return;
    this.paymentNagInterval = setInterval(() => {
      if (!this.showTicket || this.paymentCompleted) {
        this.stopPaymentNag();
        return;
      }
      const method = this.getPaymentMethodLabel();
      void this.showToast(`Reminder: Please complete your ${method} payment.`, 'warning');
    }, 60000);
  }

  private stopPaymentNag(): void {
    if (this.paymentNagInterval) {
      clearInterval(this.paymentNagInterval);
      this.paymentNagInterval = null;
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
    sessionStorage.removeItem(this.getSimStepKey());
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