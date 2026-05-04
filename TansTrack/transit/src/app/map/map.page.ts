import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import {
  ActionSheetController,
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
export class MapPage implements OnInit, ViewWillEnter {
  schedules: Schedule[] = [];
  currentSchedule: Schedule | null = null;
  allRoutes: Schedule[] = [];
  mapRouteGeoJson: { type: string; coordinates: number[][] } | null = null;
  mapRouteStops: RouteMapStop[] = [];
  mapBoardingPassengers: RouteMapBoardingPassenger[] = [];
  selectedSegment: string = 'current';
  targetScheduleId: number | null = null;
  targetRouteId: number | null = null;

  private readonly mapboxToken =
    'pk.eyJ1Ijoic2Vlam83IiwiYSI6ImNtY3ZqcWJ1czBic3QycHEycnM0d2xtaXEifQ.DdQ8QFpf5LlgTDtejDgJSA';

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private actionSheetController: ActionSheetController,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

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

  /** Laravel date may be `Y-m-d` or ISO string */
  private scheduleDateKey(s: Schedule): string {
    const d = s.date as unknown;
    if (d == null) {
      return '';
    }
    const str = typeof d === 'string' ? d : String(d);
    return str.split('T')[0];
  }

  private normalizeTime(raw: string | undefined): string | null {
    if (!raw) {
      return null;
    }
    let timePart = raw.trim();
    if (timePart.includes('T')) {
      timePart = timePart.split('T')[1] || '';
    }
    timePart = timePart.replace(/Z$/i, '');
    const m = timePart.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) {
      return null;
    }
    const hh = m[1].padStart(2, '0');
    const mm = m[2];
    const ss = (m[3] ?? '00').padStart(2, '0');
    return `${hh}:${mm}:${ss}`;
  }

  private parseScheduleStart(schedule: Schedule): Date | null {
    const day = this.scheduleDateKey(schedule);
    const t = this.normalizeTime(schedule.start_time);
    if (!day || !t) {
      return null;
    }
    const iso = `${day}T${t}`;
    const d = new Date(iso);
    return isNaN(d.getTime()) ? null : d;
  }

  private parseScheduleEnd(schedule: Schedule): Date | null {
    const day = this.scheduleDateKey(schedule);
    const t = this.normalizeTime(schedule.end_time);
    if (!day || !t) {
      return null;
    }
    const d = new Date(`${day}T${t}`);
    return isNaN(d.getTime()) ? null : d;
  }

  /**
   * Choose the schedule to show on "Current Route".
   * Previously required `now` inside [start, end), so trips accepted/active before start_time
   * never appeared; `upcoming` from API is only future dates, so today's later trips had no fallback.
   */
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
      if (hit) {
        return hit;
      }
    }

    if (this.targetRouteId) {
      const hit = combinedForLookup.find((s) => s.route?.id === this.targetRouteId);
      if (hit) {
        return hit;
      }
    }

    const st = (s: Schedule) => String(s.status || '').toLowerCase();

    // 1) In-progress today (operator/driver started trip — not tied to printed window)
    const activeToday = todaySchedules.find((s) => st(s) === 'active');
    if (activeToday) {
      return activeToday;
    }

    // 2) Today: accepted/active and current time within [start, end)
    const inWindow = todaySchedules.find((s) => {
      if (this.scheduleDateKey(s) !== todayStr) {
        return false;
      }
      const start = this.parseScheduleStart(s);
      const end = this.parseScheduleEnd(s);
      if (!start || !end) {
        return false;
      }
      const status = st(s);
      return (
        (status === 'accepted' || status === 'active') &&
        now >= start &&
        now < end
      );
    });
    if (inWindow) {
      return inWindow;
    }

    // 3) Today: accepted (or active) before start_time — show map for prep; not after end
    const todayWorkable = todaySchedules
      .filter((s) => {
        if (this.scheduleDateKey(s) !== todayStr) {
          return false;
        }
        const status = st(s);
        if (status !== 'accepted' && status !== 'active') {
          return false;
        }
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

    // 4) Future calendar days only (API "upcoming")
    return (
      upcomingSchedules.find((s) => {
        const status = st(s);
        return status === 'accepted' || status === 'active';
      }) || null
    );
  }

  loadDriverSchedules() {
    const driverId = Number(this.authService.getDriverId());
    if (!driverId) {
      return;
    }

    this.apiService.getDriverSchedules(driverId).subscribe({
      next: (response) => {
        this.mapRouteGeoJson = null;
        this.mapRouteStops = [];
        this.mapBoardingPassengers = [];

        if (!response.success || !response.schedules) {
          this.currentSchedule = null;
          this.allRoutes = [];
          return;
        }

        const now = new Date();
        const todayStr = this.localTodayYmd(now);
        const todaySchedules: Schedule[] = response.schedules.today || [];
        const upcomingSchedules: Schedule[] = response.schedules.upcoming || [];
        const pastSchedules: Schedule[] = response.schedules.past || [];

        this.currentSchedule = this.pickCurrentSchedule(
          todaySchedules,
          upcomingSchedules,
          pastSchedules,
          todayStr,
          now
        );

        this.allRoutes = [...todaySchedules, ...upcomingSchedules];

        const route = this.currentSchedule?.route;
        if (!this.currentSchedule || !route) {
          return;
        }

        this.mapRouteStops = Array.isArray(route.stops) ? route.stops : [];
        this.mapBoardingPassengers = this.currentSchedule.boarding_passengers ?? [];

        void this.buildRouteGeometry(this.currentSchedule);
      },
      error: () => {
        this.currentSchedule = null;
        this.allRoutes = [];
        this.mapRouteGeoJson = null;
        this.mapRouteStops = [];
        this.mapBoardingPassengers = [];
      }
    });
  }

  private isValidLineString(g: unknown): g is { type: string; coordinates: number[][] } {
    if (!g || typeof g !== 'object') {
      return false;
    }
    const o = g as { type?: string; coordinates?: unknown };
    return (
      o.type === 'LineString' &&
      Array.isArray(o.coordinates) &&
      o.coordinates.length >= 2
    );
  }

  private cloneLineString(g: { type: string; coordinates: number[][] }) {
    return {
      type: 'LineString' as const,
      coordinates: g.coordinates.map((c) => [Number(c[0]), Number(c[1])])
    };
  }

  private parseCoordPair(raw: string | undefined): [number, number] | null {
    if (!raw?.trim()) {
      return null;
    }
    const parts = raw.split(',').map((x) => parseFloat(x.trim()));
    if (parts.length >= 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
      return [parts[0], parts[1]];
    }
    return null;
  }

  private normalizeGeometryFromApi(geometry: unknown): { type: string; coordinates: number[][] } | null {
    let g: any = geometry;
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
    if (!this.isValidLineString(g)) {
      return null;
    }
    return this.cloneLineString(g);
  }

  private async buildRouteGeometry(schedule: Schedule) {
    const route = schedule.route;
    if (!route) {
      this.mapRouteGeoJson = null;
      return;
    }

    if (this.isValidLineString(route.map_geometry)) {
      this.mapRouteGeoJson = this.cloneLineString(route.map_geometry);
      return;
    }

    const fromField = this.normalizeGeometryFromApi(route.geometry);
    if (fromField) {
      if (fromField.coordinates.length <= 10) {
        await this.fetchDrivingRouteFromWaypoints(
          fromField.coordinates as [number, number][]
        );
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

  getScheduleRoute(schedule: Schedule): string {
    return schedule.route?.name || '';
  }

  getScheduleDestination(schedule: Schedule): string {
    return schedule.route?.end_location || '';
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
        {
          text: 'Flat tire',
          handler: () => {
            void this.submitIncident('flat_tire', driverId);
          },
        },
        {
          text: 'Road blockage',
          handler: () => {
            void this.submitIncident('road_blockage', driverId);
          },
        },
        {
          text: 'Mechanical issue',
          handler: () => {
            void this.submitIncident('mechanical', driverId);
          },
        },
        {
          text: 'Accident',
          handler: () => {
            void this.submitIncident('accident', driverId);
          },
        },
        {
          text: 'Medical emergency',
          handler: () => {
            void this.submitIncident('medical', driverId);
          },
        },
        {
          text: 'Weather',
          handler: () => {
            void this.submitIncident('weather', driverId);
          },
        },
        {
          text: 'Other',
          handler: () => {
            void this.submitIncident('other', driverId);
          },
        },
        { text: 'Cancel', role: 'cancel' },
      ],
    });
    await sheet.present();
  }

  private async submitIncident(incidentType: string, driverId: number): Promise<void> {
    const loading = await this.loadingController.create({
      message: 'Getting location…',
    });
    await loading.present();

    const pos = await new Promise<GeolocationPosition | null>((resolve) => {
      if (typeof navigator === 'undefined' || !navigator.geolocation) {
        resolve(null);
        return;
      }
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

    this.apiService
      .reportIncident({
        driver_id: driverId,
        incident_type: incidentType,
        latitude: lat,
        longitude: lng,
        location_label: locationLabel,
        ...(scheduleId ? { schedule_id: scheduleId } : {}),
      })
      .subscribe({
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
        },
      });
  }

  private async reverseGeocode(lng: number, lat: number): Promise<string> {
    const token = environment.mapbox?.accessToken || this.mapboxToken;
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(
      `${lng},${lat}`
    )}.json?access_token=${encodeURIComponent(token)}&limit=1`;
    try {
      const response = await fetch(url);
      const data = await response.json();
      const name = data?.features?.[0]?.place_name;
      if (typeof name === 'string' && name.length > 0) {
        return name;
      }
    } catch {
      /* fall through */
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  startSchedule(schedule: Schedule) {
    this.apiService.startSchedule(schedule.id).subscribe({
      next: (response) => {
        if (response.success) {
          schedule.status = 'active';
          this.loadDriverSchedules();
        }
      },
      error: () => {}
    });
  }

  completeSchedule(schedule: Schedule) {
    if (schedule.status === 'accepted') {
      this.apiService.startSchedule(schedule.id).subscribe({
        next: (startResponse) => {
          if (startResponse.success) {
            schedule.status = 'active';
            this.apiService.completeSchedule(schedule.id).subscribe({
              next: (completeResponse) => {
                if (completeResponse.success) {
                  schedule.status = 'completed';
                  this.loadDriverSchedules();
                }
              },
              error: () => {}
            });
          }
        },
        error: () => {}
      });
    } else {
      this.apiService.completeSchedule(schedule.id).subscribe({
        next: (response) => {
          if (response.success) {
            schedule.status = 'completed';
            this.loadDriverSchedules();
          }
        },
        error: () => {}
      });
    }
  }

  formatTime(timeString: string): string {
    if (!timeString) {
      return '';
    }
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

  async fetchRouteFromMapbox(startCoords: [number, number], endCoords: [number, number]) {
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

  async fetchDrivingRouteFromWaypoints(waypoints: [number, number][]) {
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
