import { Component, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
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
export class MapPage implements OnInit {
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
    private route: ActivatedRoute
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
        const todayStr = now.toISOString().split('T')[0];
        const todaySchedules: Schedule[] = response.schedules.today || [];
        const upcomingSchedules: Schedule[] = response.schedules.upcoming || [];
        const pastSchedules: Schedule[] = response.schedules.past || [];
        const combinedForLookup = [...todaySchedules, ...upcomingSchedules, ...pastSchedules];

        this.currentSchedule = null;

        if (this.targetScheduleId) {
          this.currentSchedule =
            combinedForLookup.find((s) => s.id === this.targetScheduleId) || null;
        }

        if (!this.currentSchedule && this.targetRouteId) {
          this.currentSchedule =
            combinedForLookup.find((s) => s.route?.id === this.targetRouteId) || null;
        }

        if (!this.currentSchedule) {
          this.currentSchedule =
            todaySchedules.find((s) => {
              if (this.scheduleDateKey(s) !== todayStr) {
                return false;
              }
              const start = this.parseScheduleStart(s);
              const end = this.parseScheduleEnd(s);
              if (!start || !end) {
                return false;
              }
              return (
                (s.status === 'accepted' || s.status === 'active') &&
                now >= start &&
                now < end
              );
            }) || null;
        }

        if (!this.currentSchedule) {
          this.currentSchedule =
            upcomingSchedules.find((s) => s.status === 'accepted' || s.status === 'active') ||
            null;
        }

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
