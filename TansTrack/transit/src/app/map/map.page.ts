import { Component, OnInit, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ActivatedRoute } from '@angular/router';
import {
  ActionSheetController,
  AlertController,
  LoadingController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';
import {
  RouteMapBoardingPassenger,
  RouteMapStop
} from '../components/route-map/route-map.component';

interface Schedule {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  trip_leg?: number;
  leg_status?: string;
  leg_direction?: 'outbound' | 'return';
  return_trip_status?: string;
  has_return_trip?: boolean;
  boarding_passengers?: RouteMapBoardingPassenger[];
  route?: {
    id: number;
    name: string;
    start_location: string;
    end_location: string;
    start_coordinates?: string;
    end_coordinates?: string;
    geometry?: unknown;
    /** Normalized LineString from BusOperator API (lng, lat) */
    map_geometry?: { type: string; coordinates: number[][] };
    return_geometry?: { type: string; coordinates: number[][] };
    return_map_geometry?: { type: string; coordinates: number[][] };
    stops?: RouteMapStop[];
  };
  bus?: {
    bus_number: string;
    model: string;
  };
}

@Component({
  selector: 'app-map',
  templateUrl: './map.page.html',
  styleUrls: ['./map.page.scss'],
  standalone: false
})
export class MapPage implements OnInit, OnDestroy, ViewWillEnter {
  schedules: Schedule[] = [];
  currentSchedule: Schedule | null = null;
  allRoutes: Schedule[] = [];
  mapRouteGeoJson: { type: string; coordinates: number[][] } | null = null;
  mapRouteStops: RouteMapStop[] = [];
  mapBoardingPassengers: RouteMapBoardingPassenger[] = [];
  mapAllPassengers: RouteMapBoardingPassenger[] = [];
  selectedSegment: string = 'current';
  targetScheduleId: number | null = null;
  targetRouteId: number | null = null;
  isNearDestination = false;
  isReturnTrip = false;
  private lastPositionPush = 0;
  private arrivalPromptShown = false;
  private manifestPollTimer: ReturnType<typeof setInterval> | null = null;

  get simulationKey(): string | null {
    if (!this.currentSchedule) return null;
    return `${this.currentSchedule.id}-${this.currentSchedule.trip_leg ?? 1}`;
  }

  private readonly mapboxToken =
    'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private actionSheetController: ActionSheetController,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  ngOnDestroy() {
    this.stopManifestPoll();
  }

  private startManifestPoll(scheduleId: number): void {
    this.stopManifestPoll();
    this.loadManifest(scheduleId);
    this.manifestPollTimer = setInterval(() => this.loadManifest(scheduleId), 15000);
  }

  private stopManifestPoll(): void {
    if (this.manifestPollTimer) {
      clearInterval(this.manifestPollTimer);
      this.manifestPollTimer = null;
    }
  }

  private loadManifest(scheduleId: number): void {
    this.apiService.getPassengerManifest(scheduleId).subscribe({
      next: (response) => {
        if (response?.success && Array.isArray(response?.passengers)) {
          const mapped = response.passengers.map((p: any) => ({
            public_ticket_id: p.ticket_id,
            fare: p.fare,
            commuter_name: p.commuter_name,
            commuter_email: p.commuter_email,
            alighted: p.alighted,
            boarding_lng: p.boarding_lng,
            boarding_lat: p.boarding_lat,
            boarding_stop_name: p.boarding_stop_name,
            drop_off_lng: p.drop_off_lng,
            drop_off_lat: p.drop_off_lat,
            drop_off_stop_name: p.drop_off_stop_name,
            payment_status: p.payment_status ?? null,
            is_boarding_request: p.is_boarding_request === true,
          }));
          // All passengers (including boarding requests) — fed to route-map for purple stop markers
          this.mapAllPassengers = mapped.filter((p: any) => !!p.commuter_name && !p.alighted);
          // Only ticketed, non-alighted, non-request passengers — shown in the Aboard Commuters list
          this.mapBoardingPassengers = mapped.filter((p: any) =>
            !!p.commuter_name && !p.alighted && p.is_boarding_request !== true
          );
          return;
        }

        // Safe fallback: treat non-success / no passengers as empty list.
        this.mapBoardingPassengers = [];
          this.mapAllPassengers = [];
      },
      error: (err) => {
        const status = err?.status ?? err?.error?.status;

        // If schedule is missing on the backend, stop polling to avoid spamming errors.
        if (status === 404) {
          this.stopManifestPoll();
          this.mapBoardingPassengers = [];
          this.mapAllPassengers = [];
        }
      },
    });
  }

  ngOnInit() {
    this.route.queryParams.subscribe((params) => {
      if (params['scheduleId']) {
        this.targetScheduleId = Number(params['scheduleId']);
      }
      if (params['routeId']) {
        this.targetRouteId = Number(params['routeId']);
      }
    });

    this.loadDriverSchedules();
  }

  ionViewWillEnter() {
    this.loadDriverSchedules();
  }

  /** Local calendar day `Y-m-d` (avoid UTC drift from `toISOString()`). */
  private localTodayYmd(d: Date = new Date()): string {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  }

  private scheduleDateKey(s: Schedule): string {
    const d = s.date as unknown;
    if (d == null) return '';
    const str = typeof d === 'string' ? d : String(d);
    return str.split('T')[0];
  }

  private normalizeTime(raw: string | undefined): string | null {
    if (!raw) return null;
    let timePart = raw.trim();
    if (timePart.includes('T')) {
      timePart = timePart.split('T')[1] || '';
    }
    timePart = timePart.replace(/Z$/i, '');
    const m = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const hh = m[1].padStart(2, '0');
    const mm = m[2];
    const ss = (m[3] ?? '00').padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private parseScheduleStart(schedule: Schedule): Date | null {
    const day = this.scheduleDateKey(schedule);
    const t = this.normalizeTime(schedule.start_time);
    if (!day || !t) return null;
    const d = new Date(`${day}T${t}`);
    return isNaN(d.getTime()) ? null : d;
  }

  private parseScheduleEnd(schedule: Schedule): Date | null {
    const day = this.scheduleDateKey(schedule);
    const t = this.normalizeTime(schedule.end_time);
    if (!day || !t) return null;
    const d = new Date(`${day}T${t}`);
    return isNaN(d.getTime()) ? null : d;
  }

  private isReturnLeg(schedule: Schedule | null): boolean {
    const dir = schedule?.leg_direction;
    if (dir === 'return') return true;
    if (dir === 'outbound') return false;
    const leg = schedule?.trip_leg;
    return typeof leg === 'number' ? leg % 2 === 0 : false;
  }

  private pickCurrentSchedule(
    todaySchedules: Schedule[],
    upcomingSchedules: Schedule[],
    pastSchedules: Schedule[],
    todayStr: string,
    now: Date
  ): Schedule | null {
    const combinedForLookup = [...todaySchedules, ...upcomingSchedules, ...pastSchedules];

    if (this.targetScheduleId) {
      const hit = combinedForLookup.find((s) => s.id === this.targetScheduleId);
      if (hit) return hit;
    }

    if (this.targetRouteId) {
      const hit = combinedForLookup.find((s) => s.route?.id === this.targetRouteId);
      if (hit) return hit;
    }

    const st = (s: Schedule) => String(s.status || '').toLowerCase();

    const activeToday = todaySchedules.find((s) => st(s) === 'active');
    if (activeToday) return activeToday;

    const inWindow = todaySchedules.find((s) => {
      if (this.scheduleDateKey(s) !== todayStr) return false;
      const start = this.parseScheduleStart(s);
      const end = this.parseScheduleEnd(s);
      if (!start || !end) return false;
      const status = st(s);
      return (status === 'accepted' || status === 'active' || status === 'scheduled') && now >= start && now < end;
    });
    if (inWindow) return inWindow;

    const todayWorkable = todaySchedules
      .filter((s) => {
        if (this.scheduleDateKey(s) !== todayStr) return false;
        const status = st(s);
        if (status !== 'accepted' && status !== 'active' && status !== 'scheduled') return false;
        const end = this.parseScheduleEnd(s);
        return !end || now < end;
      })
      .sort((a, b) => {
        const ta = this.parseScheduleStart(a)?.getTime() ?? 0;
        const tb = this.parseScheduleStart(b)?.getTime() ?? 0;
        return ta - tb;
      });

    if (todayWorkable.length > 0) {
      const nextByStart = todayWorkable.find((s) => {
        const t0 = this.parseScheduleStart(s);
        return t0 && t0.getTime() >= now.getTime();
      });
      return nextByStart || todayWorkable[0];
    }

    return (
      upcomingSchedules.find((s) => {
        const status = st(s);
        return status === 'accepted' || status === 'active' || status === 'scheduled';
      }) || null
    );
  }

  loadDriverSchedules() {
    const driverId = Number(this.authService.getDriverId());
    if (!driverId) return;

    this.apiService.getDriverSchedules(driverId).subscribe({
      next: (response) => {
        this.mapRouteGeoJson = null;
        this.mapRouteStops = [];
        this.mapBoardingPassengers = [];
          this.mapAllPassengers = [];
        this.isNearDestination = false;
        this.arrivalPromptShown = false;

        if (!response?.success || !response?.schedules) {
          this.currentSchedule = null;
          this.allRoutes = [];
          this.stopManifestPoll();
          return;
        }

        const now = new Date();
        const todayStr = this.localTodayYmd(now);
        const todaySchedules: Schedule[] = response.schedules.today || [];
        const upcomingSchedules: Schedule[] = response.schedules.upcoming || [];
        const pastSchedules: Schedule[] = response.schedules.past || [];

        const allSchedules = [...todaySchedules, ...upcomingSchedules, ...pastSchedules];
        const returnActiveSchedule = allSchedules.find(
          (s: any) => s.has_return_trip && s.return_trip_status === 'active'
        );

        if (returnActiveSchedule) {
          this.currentSchedule = returnActiveSchedule;
        } else {
          this.currentSchedule = this.pickCurrentSchedule(
            todaySchedules,
            upcomingSchedules,
            pastSchedules,
            todayStr,
            now
          );
        }

        this.isReturnTrip = this.isReturnLeg(this.currentSchedule);

        this.allRoutes = [...todaySchedules, ...upcomingSchedules];

        const route = this.currentSchedule?.route;
        if (!this.currentSchedule || !route) return;

        this.mapRouteStops = Array.isArray(route.stops) ? route.stops : [];
        this.mapBoardingPassengers = [];
          this.mapAllPassengers = [];
        this.startManifestPoll(this.currentSchedule.id);

        void this.buildRouteGeometry(this.currentSchedule);
      },
      error: () => {
        this.currentSchedule = null;
        this.allRoutes = [];
        this.mapRouteGeoJson = null;
        this.mapRouteStops = [];
        this.mapBoardingPassengers = [];
          this.mapAllPassengers = [];
      }
    });
  }

  private isValidLineString(g: unknown): g is { type: string; coordinates: number[][] } {
    if (!g || typeof g !== 'object') return false;
    const o = g as { type?: string; coordinates?: unknown };
    return o.type === 'LineString' && Array.isArray(o.coordinates) && o.coordinates.length >= 2;
  }

  private cloneLineString(g: { type: string; coordinates: number[][] }) {
    return {
      type: 'LineString' as const,
      coordinates: g.coordinates.map((c) => [Number(c[0]), Number(c[1])])
    };
  }

  private parseCoordPair(raw: string | undefined): [number, number] | null {
    if (!raw?.trim()) return null;
    const parts = raw.split(',').map((x) => parseFloat(x.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) return [parts[0], parts[1]];
    return null;
  }

  private normalizeGeometryFromApi(geometry: unknown): { type: string; coordinates: number[][] } | null {
    let g: any = geometry;
    if (g == null) return null;

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

    if (!this.isValidLineString(g)) return null;
    return this.cloneLineString(g);
  }

  private async buildRouteGeometry(schedule: Schedule) {
    const route = schedule.route;
    if (!route) {
      this.mapRouteGeoJson = null;
      return;
    }

    if (this.isReturnTrip) {
      const returnGeometry = this.normalizeGeometryFromApi(
        (route as any).return_map_geometry ?? (route as any).return_geometry
      );
      if (returnGeometry) {
        this.mapRouteGeoJson = returnGeometry;
        return;
      }

      if (this.isValidLineString(route.map_geometry as any)) {
        this.mapRouteGeoJson = {
          type: 'LineString',
          coordinates: [...(route.map_geometry as any).coordinates]
            .reverse()
            .map((c: any) => [Number(c[0]), Number(c[1])])
        };
        return;
      }

      const retStart = this.parseCoordPair(route.end_coordinates);
      const retEnd = this.parseCoordPair(route.start_coordinates);
      if (retStart && retEnd) {
        await this.fetchRouteFromMapbox(retStart, retEnd);
        return;
      }

      this.mapRouteGeoJson = null;
      return;
    }

    if (this.isValidLineString(route.map_geometry as any)) {
      this.mapRouteGeoJson = this.cloneLineString(route.map_geometry as any);
      return;
    }

    const fromField = this.normalizeGeometryFromApi((route as any).geometry);
    if (fromField) {
      if (fromField.coordinates.length <= 10) {
        await this.fetchDrivingRouteFromWaypoints(fromField.coordinates as [number, number][]);
      } else {
        this.mapRouteGeoJson = fromField;
      }
      return;
    }

    const start = this.parseCoordPair(route.start_coordinates);
    const end = this.parseCoordPair(route.end_coordinates);
    if (start && end) {
      await this.fetchRouteFromMapbox(start, end);
      return;
    }

    if (this.mapRouteStops.length) {
      this.mapRouteGeoJson = null;
      return;
    }

    this.mapRouteGeoJson = null;
  }

  getScheduleTime(schedule: Schedule): string {
    return `${this.formatTime(schedule.start_time)} - ${this.formatTime(schedule.end_time)}`;
  }

  private shortLocation(loc: string): string {
    const beforeComma = loc.split(',')[0].trim();
    return beforeComma.includes(' ') ? beforeComma.split(' ')[0] : beforeComma;
  }

  getScheduleRoute(schedule: Schedule): string {
    const r = schedule.route;
    if (!r) return '';
    if (this.isReturnTrip && r.end_location && r.start_location) {
      return `${this.shortLocation(r.end_location)} to ${this.shortLocation(r.start_location)}`;
    }
    return r.start_location && r.end_location
      ? `${this.shortLocation(r.start_location)} to ${this.shortLocation(r.end_location)}`
      : r.name || '';
  }

  getScheduleDestination(schedule: Schedule): string {
    const r = schedule.route;
    if (!r) return '';
    if (this.isReturnTrip && r.start_location) {
      return r.start_location;
    }
    return r.end_location || '';
  }

  refreshSchedules() {
    this.loadDriverSchedules();
  }

  async openIncidentReport(): Promise<void> {
    const driverId = Number(this.authService.getDriverId());
    if (!driverId) {
      const t = await this.toastController.create({
        message: 'Sign in as a driver to report incidents',
        duration: 2500,
        color: 'warning',
      });
      await t.present();
      return;
    }

    const sheet = await this.actionSheetController.create({
      header: 'Report incident',
      subHeader: 'Location is shared with your bus operator.',
      buttons: [
        { text: 'Flat tire', handler: () => void this.submitIncident('flat_tire', driverId) },
        { text: 'Road blockage', handler: () => void this.submitIncident('road_blockage', driverId) },
        { text: 'Mechanical issue', handler: () => void this.submitIncident('mechanical', driverId) },
        { text: 'Accident', handler: () => void this.submitIncident('accident', driverId) },
        { text: 'Medical emergency', handler: () => void this.submitIncident('medical', driverId) },
        { text: 'Weather', handler: () => void this.submitIncident('weather', driverId) },
        { text: 'Other', handler: () => void this.submitIncident('other', driverId) },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async submitIncident(incidentType: string, driverId: number): Promise<void> {
    const loading = await this.loadingController.create({ message: 'Getting location…' });
    await loading.present();

    const pos = await new Promise<GeolocationPosition | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
      navigator.geolocation.getCurrentPosition(
        (p) => resolve(p),
        () => resolve(null),
        { enableHighAccuracy: true, timeout: 22000, maximumAge: 0 }
      );
    });

    if (!pos) {
      await loading.dismiss();
      const t = await this.toastController.create({
        message: 'Location is required. Enable GPS and try again.',
        duration: 3500,
        color: 'danger',
      });
      await t.present();
      return;
    }

    const lat = pos.coords.latitude;
    const lng = pos.coords.longitude;
    const locationLabel = await this.reverseGeocode(lng, lat);
    const scheduleId = this.currentSchedule?.id;

    this.apiService.reportIncident({
      driver_id: driverId,
      incident_type: incidentType,
      latitude: lat,
      longitude: lng,
      location_label: locationLabel,
      ...(scheduleId ? { schedule_id: scheduleId } : {}),
    }).subscribe({
      next: async () => {
        await loading.dismiss();
        const t = await this.toastController.create({
          message: 'Incident sent to your operator',
          duration: 2500,
          color: 'success',
        });
        await t.present();
      },
      error: async () => {
        await loading.dismiss();
        const t = await this.toastController.create({
          message: 'Could not send incident. Check connection and try again.',
          duration: 3500,
          color: 'danger',
        });
        await t.present();
      }
    });
  }

  private async reverseGeocode(lng: number, lat: number): Promise<string> {
    const token = (environment as any).mapbox?.accessToken || this.mapboxToken;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(`${lng},${lat}`)}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      const name = data?.features?.[0]?.place_name;
      if (typeof name === 'string' && name.length > 0) return name;
    } catch {}
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  onBusPositionUpdate(pos: { lng: number; lat: number }) {
    const now = Date.now();
    if (now - this.lastPositionPush < 5000) return;
    this.lastPositionPush = now;
    const id = this.currentSchedule?.id;
    if (!id) return;
    this.apiService.updateSchedulePosition(id, pos.lat, pos.lng).subscribe();
  }

  async onArrivedAtDestination() {
    if (this.arrivalPromptShown || !this.currentSchedule) return;
    this.arrivalPromptShown = true;
    this.isNearDestination = true;
    this.doCompleteSchedule(this.currentSchedule);
  }

  async onPassengerDropOff(event: { ticketId: string; commuterName: string; stopName: string }) {
    // Remove from local lists immediately so the count updates without waiting for next poll
    this.mapBoardingPassengers = this.mapBoardingPassengers.filter(
      p => p.public_ticket_id !== event.ticketId
    );
    this.mapAllPassengers = this.mapAllPassengers.filter(
      p => p.public_ticket_id !== event.ticketId
    );

    // Notify the backend — driver_id proves authority over this schedule's tickets.
    const driverId = Number(this.authService.getDriverId());
    const body: { public_ticket_id: string; driver_id?: number } = { public_ticket_id: event.ticketId };
    if (Number.isFinite(driverId) && driverId > 0) {
      body.driver_id = driverId;
    }
    this.apiService.post('commuter/alight', body).subscribe({
      error: (err) => console.warn('driver-side alight failed', err),
    });

    const toast = await this.toastController.create({
      message: `${event.commuterName} wants to drop off in stop ${event.stopName}`,
      duration: 4000,
      color: 'warning',
      position: 'top',
      icon: 'exit-outline',
    });
    await toast.present();
  }

  async respondToSchedule(scheduleId: number, action: 'accept' | 'decline') {
    if (action === 'decline') {
      const alert = await this.alertController.create({
        header: 'Decline Schedule',
        message: 'Please provide a reason. The operator will review your request.',
        inputs: [{ name: 'reason', type: 'textarea', placeholder: 'Enter your reason here…', attributes: { maxlength: 500 } }],
        buttons: [
          { text: 'Cancel', role: 'cancel' },
          {
            text: 'Submit Decline',
            handler: async (data) => {
              const reason = (data.reason || '').trim();
              if (reason.length < 5) {
                const t = await this.toastController.create({
                  message: 'Please provide a valid reason (at least 5 characters).',
                  duration: 2000,
                  color: 'warning'
                });
                await t.present();
                return false;
              }
              await this.submitDecline(scheduleId, reason);
              return true;
            }
          }
        ]
      });
      await alert.present();
      return;
    }

    try {
      const response: any = await this.apiService.acceptSchedule(scheduleId).toPromise();
      if (response?.success) {
        const toast = await this.toastController.create({
          message: 'Schedule accepted.',
          duration: 2000,
          color: 'success'
        });
        await toast.present();
        this.loadDriverSchedules();
      } else {
        throw new Error(response?.message || 'Failed');
      }
    } catch (error: any) {
      const toast = await this.toastController.create({
        message: error.message || 'Could not accept schedule.',
        duration: 2500,
        color: 'danger'
      });
      await toast.present();
    }
  }

  private async submitDecline(scheduleId: number, reason: string) {
    try {
      const response: any = await this.apiService.declineSchedule(scheduleId, reason).toPromise();
      if (response?.success) {
        const toast = await this.toastController.create({
          message: 'Decline request submitted. Awaiting operator approval.',
          duration: 2500,
          color: 'warning'
        });
        await toast.present();
        this.loadDriverSchedules();
      } else {
        throw new Error(response?.message || 'Failed');
      }
    } catch (error: any) {
      const toast = await this.toastController.create({
        message: error.message || 'Could not submit decline request.',
        duration: 2500,
        color: 'danger'
      });
      await toast.present();
    }
  }


  startSchedule(schedule: Schedule) {
    const call$ = this.apiService.startSchedule(schedule.id);

    call$.subscribe({
      next: (response) => {
        if (response.success) {
          // Reset arrival gate so subsequent leg completions can be processed.
          this.arrivalPromptShown = false;
          this.isNearDestination = false;

          schedule.status = 'active';
          this.loadDriverSchedules();
        }
      },

      error: () => this.loadDriverSchedules()
    });
  }

  private doCompleteSchedule(schedule: Schedule) {
    if (this.isReturnTrip) {
      this.apiService.completeReturnTrip(schedule.id).subscribe({
        next: async (response) => {
          if (response.success) {
            try { sessionStorage.removeItem(`driver_sim_step_${this.simulationKey}`); } catch {}
            this.isReturnTrip = false;
            this.loadDriverSchedules();
            const toast = await this.toastController.create({
              message: 'Return trip completed!',
              duration: 3500,
              color: 'success',
              position: 'top',
              icon: 'checkmark-circle-outline'
            });
            await toast.present();
          }
        },
        error: () => this.loadDriverSchedules()
      });
      return;
    }

    const doComplete = () => {
      this.apiService.completeSchedule(schedule.id).subscribe({
        next: async (response) => {
          if (response.success) {
            try { sessionStorage.removeItem(`driver_sim_step_${this.simulationKey}`); } catch {}
            this.loadDriverSchedules();
            const toast = await this.toastController.create({
              message: 'Trip completed! Check your schedule for the return trip.',
              duration: 3500,
              color: 'success',
              position: 'top',
              icon: 'checkmark-circle-outline'
            });
            await toast.present();
          }
        },
        error: () => this.loadDriverSchedules()
      });
    };

    if (schedule.status === 'accepted') {
      this.apiService.startSchedule(schedule.id).subscribe({
        next: (res) => { if (res.success) { schedule.status = 'active'; doComplete(); } },
        error: () => this.loadDriverSchedules()
      });
    } else {
      doComplete();
    }
  }

  async completeTripLeg() {
    if (!this.currentSchedule) return;
    try {
      await firstValueFrom(this.apiService.completeSchedule(this.currentSchedule.id));
      const toast = await this.toastController.create({
        message: 'Trip leg completed. Accept the next leg to continue.',
        duration: 3000, color: 'success'
      });
      await toast.present();
      this.loadDriverSchedules();
    } catch (e: any) {
      const toast = await this.toastController.create({
        message: e?.error?.message || e?.message || 'Could not complete trip.',
        duration: 2500, color: 'danger'
      });
      await toast.present();
    }
  }

  async endDayTrip() {
    if (!this.currentSchedule) return;
    const scheduleId = this.currentSchedule.id;
    const alert = await this.alertController.create({
      header: 'End Day',
      message: 'Are you sure you want to end your day? The schedule will be marked as completed.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'End Day',
          cssClass: 'alert-button-danger',
          handler: async () => {
            try {
              await firstValueFrom(this.apiService.endDay(scheduleId));
              const toast = await this.toastController.create({
                message: 'Day ended. Schedule completed.', duration: 2000, color: 'success'
              });
              await toast.present();
              this.loadDriverSchedules();
            } catch (e: any) {
              const toast = await this.toastController.create({
                message: e?.error?.message || e?.message || 'Could not end day.',
                duration: 2500, color: 'danger'
              });
              await toast.present();
            }
          }
        }
      ]
    });
    await alert.present();
  }

  formatTime(timeString: string): string {
    if (!timeString) return '';
    const t = timeString.includes('T') ? timeString.split('T')[1] || timeString : timeString;
    const [hours, minutes] = t.split(':');
    const date = new Date();
    date.setHours(parseInt(hours, 10), parseInt(minutes, 10));
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  private async fetchRouteFromMapbox(startCoords: [number, number], endCoords: [number, number]) {
    const coordsString = `${startCoords[0]},${startCoords[1]};${endCoords[0]},${endCoords[1]}`;
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${this.mapboxToken}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes?.[0]?.geometry) {
        this.mapRouteGeoJson = data.routes[0].geometry;
      } else {
        this.mapRouteGeoJson = {
          type: 'LineString',
          coordinates: [startCoords, endCoords]
        };
      }
    } catch {
      this.mapRouteGeoJson = {
        type: 'LineString',
        coordinates: [startCoords, endCoords]
      };
    }
  }

  private async fetchDrivingRouteFromWaypoints(waypoints: [number, number][]) {
    const coordsString = waypoints.map((c) => `${c[0]},${c[1]}`).join(';');
    const url = `https://api.mapbox.com/directions/v5/mapbox/driving/${coordsString}?geometries=geojson&overview=full&access_token=${this.mapboxToken}`;

    try {
      const response = await fetch(url);
      const data = await response.json();

      if (data.routes?.[0]?.geometry) {
        this.mapRouteGeoJson = data.routes[0].geometry;
      } else {
        this.mapRouteGeoJson = {
          type: 'LineString',
          coordinates: waypoints
        };
      }
    } catch {
      this.mapRouteGeoJson = {
        type: 'LineString',
        coordinates: waypoints
      };
    }
  }
}

