import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import {
  AlertController,
  LoadingController,
  ToastController,
  ViewWillEnter,
} from '@ionic/angular';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { environment } from '../../environments/environment';

interface Schedule {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  /** Passengers still on board (distinct commuters + guests, capped by capacity). */
  aboard_count?: number;
  /** Active ticket rows only (not yet alighted). */
  boarding_passengers?: unknown[];
  route?: {
    id: number;
    name: string;
    start_location: string;
    end_location: string;
  };
  bus?: {
    id: number;
    bus_number: string;
    model: string;
    capacity?: number;
  };
}

// ✅ UPDATE THIS INTERFACE TO MATCH API RESPONSE
interface Notification {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    name: string;
  };
  driver?: {
    name: string;
  };
  schedule?: {
    id: number;
  };
  bus?: {
    bus_number: string;
  };
}

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, ViewWillEnter {
  currentTime: string = '';
  /** Passengers with tickets for the current schedule’s bus/route */
  currentPassengers: number = 0;
  greeting: string = 'Good Morning';
  /** Bus seating capacity for the current schedule */
  expectedCapacity: number = 0;
  userName: string = 'Driver';
  currentSchedule: Schedule | null = null;
  nextSchedule: Schedule | null = null;
  recentNotifications: Notification[] = []; 
  unreadNotificationsCount: number = 0;
  private schedulePoll?: ReturnType<typeof setInterval>;

  /** Live terminal bay countdown when the driver is assigned a space from Terminal Manager */
  terminalParking: {
    occupied: boolean;
    space_id?: string;
    remaining_seconds?: number;
    pending_extension_minutes?: number | null;
    can_request_extension?: boolean;
    extension_request_used?: boolean;
  } | null = null;

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  async ngOnInit() {
    this.updateTime();
    setInterval(() => this.updateTime(), 1000);
    this.loadDriverSchedules();
    this.loadDriverProfile();
    this.loadRecentNotifications();

    setInterval(() => {
      this.loadRecentNotifications();
    }, 10000);

    this.schedulePoll = setInterval(() => this.loadDriverSchedules(), 30000);

    this.loadTerminalParking();
    setInterval(() => this.loadTerminalParking(), 15000);
  }

  ionViewWillEnter() {
    this.loadDriverSchedules();
    this.loadTerminalParking();
  }

  async loadRecentNotifications() {
    try {
      const driverId = this.authService.getDriverId();
      if (!driverId) return;

      const response: any = await this.apiService.getDriverNotifications(Number(driverId)).toPromise();
      
      if (response.success) {
        this.recentNotifications = response.notifications || [];
        this.unreadNotificationsCount = this.recentNotifications.filter((n: any) => !n.is_read).length;
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
    }
  }

  updateTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    this.greeting = this.getGreeting(now);

    if (this.terminalParking?.occupied && (this.terminalParking.remaining_seconds ?? 0) > 0) {
      this.terminalParking = {
        ...this.terminalParking,
        remaining_seconds: (this.terminalParking.remaining_seconds ?? 0) - 1,
      };
    }
  }

  getTerminalBayCountdownDisplay(): string {
    const sec = this.terminalParking?.remaining_seconds ?? 0;
    if (sec <= 0) return '00:00';
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  async loadTerminalParking() {
    const driverId = this.authService.getDriverId();
    if (!driverId) {
      this.terminalParking = null;
      return;
    }
    try {
      const res: any = await firstValueFrom(
        this.apiService.getTerminalParkingStatus(Number(driverId))
      );
      if (!res?.success || !res.occupied) {
        this.terminalParking = null;
        return;
      }
      this.terminalParking = {
        occupied: true,
        space_id: res.space_id,
        remaining_seconds: res.remaining_seconds,
        pending_extension_minutes: res.pending_extension_minutes ?? null,
        can_request_extension: !!res.can_request_extension,
        extension_request_used: !!res.extension_request_used,
      };
    } catch {
      /* keep last known state */
    }
  }

  async promptTerminalExtension() {
    const driverId = this.authService.getDriverId();
    if (!driverId) return;

    const alert = await this.alertController.create({
      header: 'Request extra time',
      message: 'One request per bay stay. Enter 5–20 minutes.',
      inputs: [
        {
          name: 'mins',
          type: 'number',
          placeholder: 'Minutes (5–20)',
          min: 5,
          max: 20,
        },
      ],
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Send',
          handler: async (data) => {
            const raw = Number(data.mins);
            if (Number.isNaN(raw) || raw < 5 || raw > 20) {
              const t = await this.toastController.create({
                message: 'Enter a number between 5 and 20.',
                duration: 2500,
                color: 'warning',
              });
              await t.present();
              return false;
            }
            try {
              const out: any = await firstValueFrom(
                this.apiService.requestTerminalParkingExtension(Number(driverId), raw)
              );
              if (out?.success) {
                const ok = await this.toastController.create({
                  message: out.message || 'Request sent',
                  duration: 2500,
                  color: 'success',
                });
                await ok.present();
                await this.loadTerminalParking();
                await this.loadRecentNotifications();
              } else {
                const bad = await this.toastController.create({
                  message: out?.message || 'Could not send request',
                  duration: 3000,
                  color: 'danger',
                });
                await bad.present();
              }
            } catch (e: any) {
              const err = await this.toastController.create({
                message: e?.message || 'Request failed',
                duration: 3000,
                color: 'danger',
              });
              await err.present();
            }
            return true;
          },
        },
      ],
    });
    await alert.present();
  }

  getGreeting(date: Date): string {
    const hour = date.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  loadDriverProfile() {
    const name = this.authService.getDriverName() ?? this.authService.getCurrentUser()?.name;
    if (name) {
      this.userName = name;
    }
  }

  async respondToSchedule(scheduleId: number, action: 'accept' | 'decline') {
    try {
      const response: any = await (action === 'accept'
        ? this.apiService.acceptSchedule(scheduleId)
        : this.apiService.declineSchedule(scheduleId)
      ).toPromise();

      if (response?.success) {
        const toast = await this.toastController.create({
          message: action === 'accept' ? 'Schedule accepted.' : 'Schedule declined.',
          duration: 2000,
          color: action === 'accept' ? 'success' : 'medium',
        });
        await toast.present();
        await this.loadDriverSchedules();
      } else {
        throw new Error(response?.message || 'Failed');
      }
    } catch (error: any) {
      const toast = await this.toastController.create({
        message: error.message || 'Could not update schedule.',
        duration: 2500,
        color: 'danger',
      });
      await toast.present();
    }
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Confirm Logout',
      message: 'Are you sure you want to log out?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          handler: async () => {
            try {
              await this.authService.logout();
              this.router.navigate(['/login']);
              const toast = await this.toastController.create({
                message: 'Logged out successfully.',
                duration: 2000,
                color: 'success',
              });
              await toast.present();
            } catch (error) {
              console.error('Logout error:', error);
              const toast = await this.toastController.create({
                message: 'Error logging out. Please try again.',
                duration: 2000,
                color: 'danger',
              });
              await toast.present();
            }
          }
        }
      ]
    });

    await alert.present();
  }

  async loadDriverSchedules() {
    const driverId = this.authService.getDriverId();
    if (!driverId) {
      return;
    }

    const driverIdNum = Number(driverId);

    try {
      const response: any = await this.apiService.getDriverSchedules(driverIdNum).toPromise();
      if (!response?.success || !response.schedules) {
        this.currentSchedule = null;
        this.nextSchedule = null;
        this.applyPassengerCounts(null);
        return;
      }

      const todayList: Schedule[] = response.schedules.today || [];
      const upcomingList: Schedule[] = response.schedules.upcoming || [];

      const usable = (s: Schedule) =>
        ['accepted', 'scheduled', 'active'].includes(s.status);

      const merged = [...todayList, ...upcomingList].filter(usable);
      merged.sort((a, b) => this.scheduleSortKey(a) - this.scheduleSortKey(b));

      const now = new Date();

      let current: Schedule | null =
        merged.find((s) => s.status === 'active') ?? null;

      if (!current) {
        current =
          merged.find((s) => this.isScheduleInProgress(s, now)) ?? null;
      }

      if (!current) {
        current =
          merged.find((s) => this.scheduleStartDate(s)! > now) ?? null;
      }

      if (!current) {
        current = merged[0] ?? null;
      }

      let next: Schedule | null = null;
      if (current) {
        const idx = merged.indexOf(current);
        if (idx >= 0 && idx < merged.length - 1) {
          next = merged[idx + 1];
        }
      } else {
        next = merged[0] ?? null;
      }

      this.currentSchedule = current;
      this.nextSchedule = next;
      this.applyPassengerCounts(current);
    } catch (error) {
      console.error('Error loading driver schedules:', error);
      this.presentToast('Error loading schedules.', 'danger');
      this.currentSchedule = null;
      this.nextSchedule = null;
      this.applyPassengerCounts(null);
    }
  }

  private applyPassengerCounts(current: Schedule | null) {
    if (!current) {
      this.currentPassengers = 0;
      this.expectedCapacity = 0;
      return;
    }
    if (typeof current.aboard_count === 'number' && !Number.isNaN(current.aboard_count)) {
      this.currentPassengers = current.aboard_count;
    } else {
      this.currentPassengers = Array.isArray(current.boarding_passengers)
        ? current.boarding_passengers.length
        : 0;
    }
    const cap = current.bus?.capacity;
    this.expectedCapacity =
      typeof cap === 'number' && !isNaN(cap) && cap > 0 ? cap : 0;
  }

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

  private scheduleStartDate(s: Schedule): Date | null {
    const day = this.scheduleDateKey(s);
    const t = this.normalizeTime(s.start_time);
    if (!day || !t) {
      return null;
    }
    const d = new Date(`${day}T${t}`);
    return isNaN(d.getTime()) ? null : d;
  }

  private scheduleEndDate(s: Schedule): Date | null {
    const day = this.scheduleDateKey(s);
    const t = this.normalizeTime(s.end_time);
    if (!day || !t) {
      return null;
    }
    const d = new Date(`${day}T${t}`);
    return isNaN(d.getTime()) ? null : d;
  }

  private scheduleSortKey(s: Schedule): number {
    const d = this.scheduleStartDate(s);
    return d ? d.getTime() : 0;
  }

  private isScheduleInProgress(s: Schedule, now: Date): boolean {
    if (!['accepted', 'scheduled', 'active'].includes(s.status)) {
      return false;
    }
    const st = this.scheduleStartDate(s);
    const en = this.scheduleEndDate(s);
    if (!st || !en) {
      return false;
    }
    return now >= st && now <= en;
  }

  async showNotifications() {
    this.router.navigate(['/tabs/notifications']);
  }

  getNotificationIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'emergency': 'alert-circle',
      'issue_report': 'warning',
      'schedule_update': 'calendar',
      'inspection_required': 'construct',
      'general': 'notifications'
    };
    return icons[type] || 'notifications';
  }

  getNotificationColor(type: string): string {
    const colors: { [key: string]: string } = {
      'emergency': 'danger',
      'issue_report': 'warning',
      'schedule_update': 'primary',
      'inspection_required': 'medium',
      'general': 'dark'
    };
    return colors[type] || 'dark';
  }

  getNotificationTitle(type: string): string {
    const titles: { [key: string]: string } = {
      'emergency': 'Emergency Alert',
      'issue_report': 'Issue Report',
      'schedule_update': 'Schedule Update',
      'inspection_required': 'Inspection Required',
      'general': 'Notification'
    };
    return titles[type] || 'Notification';
  }

  formatNotificationTime(createdAt: string): string {
    const date = new Date(createdAt);
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
    
    if (diffInMinutes < 1) return 'Just now';
    if (diffInMinutes < 60) return `${diffInMinutes} min ago`;
    if (diffInMinutes < 1440) return `${Math.floor(diffInMinutes / 60)} hr ago`;
    return date.toLocaleDateString();
  }

  async navigateToProfile() {
    this.router.navigate(['/profile']);
  }

  async handleQuickAction(action: string) {
    switch (action) {
      case 'start-route':
        if (this.currentSchedule) {
          this.router.navigate(['/tabs/routes'], {
            queryParams: {
              scheduleId: this.currentSchedule.id,
              routeId: this.currentSchedule.route?.id,
            },
          });
        } else {
          const toast = await this.toastController.create({
            message: 'No active route to start.',
            duration: 2000,
            color: 'warning',
          });
          await toast.present();
        }
        break;
      case 'report-issue':
        this.presentReportIssueAlert();
        break;
      case 'emergency':
        this.presentEmergencyAlert();
        break;
      default:
        console.warn('Unknown quick action:', action);
    }
  }

  async presentReportIssueAlert() {
    const alert = await this.alertController.create({
      header: 'Report incident',
      message:
        'Choose the incident type. Your current GPS location will be sent to your operator (shown on Trip Logs map and Notifications).',
      inputs: [
        {
          name: 'issueType',
          type: 'radio',
          label: 'Flat tire',
          value: 'flat_tire',
          checked: true,
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Road blockage / delay',
          value: 'road_blockage',
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Mechanical problem',
          value: 'mechanical',
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Accident',
          value: 'accident',
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Medical',
          value: 'medical',
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Weather',
          value: 'weather',
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Other',
          value: 'other',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Next',
          handler: (issueType) => {
            if (issueType) {
              void this.presentIssueDetailsAlert(String(issueType));
            }
          },
        },
      ],
    });

    await alert.present();
  }

  /** Maps legacy or UI keys to API incident_type. */
  private mapToIncidentType(raw: string): string {
    const key = String(raw || '').toLowerCase();
    const legacy: Record<string, string> = {
      traffic: 'road_blockage',
      traffic_delay: 'road_blockage',
    };
    const allowed = new Set([
      'flat_tire',
      'road_blockage',
      'mechanical',
      'accident',
      'medical',
      'weather',
      'other',
    ]);
    if (legacy[key]) {
      return legacy[key];
    }
    if (allowed.has(key)) {
      return key;
    }
    return 'other';
  }

  private async reverseGeocode(lng: number, lat: number): Promise<string> {
    const token = environment.mapbox?.accessToken || '';
    if (!token) {
      return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
    }
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
      /* ignore */
    }
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }

  async presentIssueDetailsAlert(issueType: string) {
    const incidentType = this.mapToIncidentType(issueType);
    const issueLabels: Record<string, string> = {
      flat_tire: 'Flat tire',
      road_blockage: 'Road blockage / delay',
      mechanical: 'Mechanical problem',
      accident: 'Accident',
      medical: 'Medical',
      weather: 'Weather',
      other: 'Other',
      traffic: 'Road blockage / delay',
    };

    const alert = await this.alertController.create({
      header: `Report: ${issueLabels[incidentType] || issueLabels[issueType] || 'Incident'}`,
      message:
        'Add optional notes, then submit. We will use your device GPS so the operator can see you on the map.',
      inputs: [
        {
          name: 'details',
          type: 'textarea',
          placeholder: 'Optional details…',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Submit',
          handler: async (data) => {
            await this.submitIncidentWithGps(incidentType, String(data?.details || ''));
          },
        },
      ],
    });

    await alert.present();
  }

  private async submitIncidentWithGps(
    incidentType: string,
    details: string
  ): Promise<void> {
    const driverIdNum = Number(this.authService.getDriverId());
    if (isNaN(driverIdNum)) {
      await this.presentToast('Invalid driver ID', 'danger');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Getting location…',
    });
    await loading.present();

    try {
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
        await this.presentToast(
          'Location required. Enable GPS and try again.',
          'danger'
        );
        return;
      }

      const lat = pos.coords.latitude;
      const lng = pos.coords.longitude;

      const locationLabel = await this.reverseGeocode(lng, lat);
      const scheduleId = this.currentSchedule?.id;

      await firstValueFrom(
        this.apiService.reportIncident({
          driver_id: driverIdNum,
          incident_type: incidentType,
          latitude: lat,
          longitude: lng,
          location_label: locationLabel,
          ...(scheduleId ? { schedule_id: scheduleId } : {}),
          ...(details.trim() ? { notes: details.trim() } : {}),
        })
      );

      await loading.dismiss();
      await this.presentToast(
        'Incident reported with your location. Operator can see it on Trip Logs and Notifications.',
        'success'
      );
    } catch (error) {
      console.error('Incident report error:', error);
      await loading.dismiss();
      await this.presentToast(
        'Could not send incident. Check connection and try again.',
        'danger'
      );
    }
  }

  async presentEmergencyAlert() {
    const alert = await this.alertController.create({
      header: '🚨 Emergency Alert',
      message: 'What type of emergency are you experiencing?',
      inputs: [
        {
          name: 'emergencyType',
          type: 'radio',
          label: 'Medical Emergency',
          value: 'Medical Emergency',
          checked: true
        },
        {
          name: 'emergencyType',
          type: 'radio',
          label: 'Safety Threat',
          value: 'Safety Threat',
        },
        {
          name: 'emergencyType',
          type: 'radio',
          label: 'Vehicle Breakdown',
          value: 'Vehicle Breakdown',
        },
        {
          name: 'emergencyType',
          type: 'radio',
          label: 'Fire or Smoke',
          value: 'Fire or Smoke',
        },
        {
          name: 'emergencyType',
          type: 'radio',
          label: 'Collision',
          value: 'Collision',
        },
        {
          name: 'emergencyType',
          type: 'radio',
          label: 'Other Emergency',
          value: 'Other Emergency',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Next',
          handler: (emergencyType) => {
            if (emergencyType) {
              this.presentEmergencyConfirmation(emergencyType);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async presentEmergencyConfirmation(emergencyType: string) {
    const alert = await this.alertController.create({
      header: '⚠️ Confirm Emergency',
      message: `You are about to send an emergency alert for: <strong>${emergencyType}</strong>.<br><br>This will immediately notify your operator and emergency services. Are you sure?`,
      inputs: [
        {
          name: 'location',
          type: 'textarea',
          placeholder: 'Your current location (optional)',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Send Alert',
          cssClass: 'alert-button-confirm',
          handler: async (data) => {
            try {
              const driverId = this.authService.getDriverId();
              const driverIdNum = Number(driverId);
              
              if (isNaN(driverIdNum)) {
                console.error('Invalid driver ID');
                this.presentToast('Invalid driver ID', 'danger');
                return;
              }

              const location = data.location ? ` Location: ${data.location}` : '';
              const message = `EMERGENCY: ${emergencyType}.${location}`;
              
              const response = await this.apiService.sendEmergencyAlert(driverIdNum, emergencyType, message).toPromise();
              
              if (response.success) {
                this.presentToast('🚨 Emergency alert sent!', 'danger');
              } else {
                this.presentToast(response.message || 'Error sending emergency alert.', 'danger');
              }
            } catch (error) {
              console.error('Error sending emergency alert:', error);
              this.presentToast('Error sending emergency alert.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
    });
    await toast.present();
  }

  getScheduleRoute(schedule: Schedule | null): string {
    if (!schedule || !schedule.route) return 'N/A';
    return schedule.route.name || `${schedule.route.start_location} to ${schedule.route.end_location}`;
  }

  getScheduleDestination(schedule: Schedule | null): string {
    if (!schedule || !schedule.route) return 'N/A';
    return schedule.route.end_location || 'N/A';
  }

  getScheduleTime(schedule: Schedule | null): string {
    if (!schedule) {
      return 'N/A';
    }
    return `${this.formatClockDisplay(schedule.start_time)} - ${this.formatClockDisplay(schedule.end_time)}`;
  }

  private formatClockDisplay(raw: string | undefined): string {
    if (!raw) {
      return '';
    }
    let timePart = raw.trim();
    if (timePart.includes('T')) {
      timePart = timePart.split('T')[1] || '';
    }
    timePart = timePart.replace(/Z$/i, '').substring(0, 8);
    const m = timePart.match(/^(\d{1,2}):(\d{2})/);
    if (!m) {
      return raw;
    }
    const date = new Date();
    date.setHours(parseInt(m[1], 10), parseInt(m[2], 10), 0, 0);
    return date.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    });
  }

  nextScheduleBadgeColor(): string {
    const s = this.nextSchedule?.status;
    if (s === 'active') {
      return 'success';
    }
    if (s === 'accepted') {
      return 'tertiary';
    }
    if (s === 'scheduled') {
      return 'warning';
    }
    return 'medium';
  }

  displayScheduleStatus(schedule: Schedule | null): string {
    if (!schedule?.status) {
      return '';
    }
    return schedule.status.charAt(0).toUpperCase() + schedule.status.slice(1);
  }

  getScheduleDate(schedule: Schedule | null): string {
    if (!schedule) return 'N/A';
    const scheduleDate = new Date(schedule.date);
    const today = new Date();
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    if (scheduleDate.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (scheduleDate.toDateString() === tomorrow.toDateString()) {
      return 'Tomorrow';
    } else {
      return scheduleDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    }
  }
}