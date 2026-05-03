import { Component, OnInit } from '@angular/core';
import { Router } from '@angular/router';
import { AlertController, ToastController, ViewWillEnter } from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

interface Schedule {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  /** Ticket rows for this schedule (same bus/route booking) — length = boarding count */
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

  constructor(
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private alertController: AlertController,
    private toastController: ToastController
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
  }

  ionViewWillEnter() {
    this.loadDriverSchedules();
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
  }

  getGreeting(date: Date): string {
    const hour = date.getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  loadDriverProfile() {
    const user = this.authService.getCurrentUser();
    if (user && user.name) {
      this.userName = user.name;
    } else {
      console.warn('User profile not found in AuthService, using default name.');
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
    this.currentPassengers = Array.isArray(current.boarding_passengers)
      ? current.boarding_passengers.length
      : 0;
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
      header: 'Report Issue',
      message: 'Select the type of issue and provide details.',
      inputs: [
        {
          name: 'issueType',
          type: 'radio',
          label: 'Mechanical Problem',
          value: 'mechanical',
          checked: true
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Traffic Delay',
          value: 'traffic',
        },
        {
          name: 'issueType',
          type: 'radio',
          label: 'Accident',
          value: 'accident',
        },
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel',
        },
        {
          text: 'Next',
          handler: async (issueType) => {
            if (issueType) {
              this.presentIssueDetailsAlert(issueType);
            }
          },
        },
      ],
    });

    await alert.present();
  }

  async presentIssueDetailsAlert(issueType: string) {
    const issueLabels: any = {
      mechanical: 'Mechanical Problem',
      traffic: 'Traffic Delay',
      accident: 'Accident'
    };

    const alert = await this.alertController.create({
      header: `Report ${issueLabels[issueType]}`,
      message: 'Please provide additional details about the issue.',
      inputs: [
        {
          name: 'details',
          type: 'textarea',
          placeholder: 'Describe the issue...',
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
            try {
              const driverId = this.authService.getDriverId();
              const driverIdNum = Number(driverId);
              
              if (isNaN(driverIdNum)) {
                console.error('Invalid driver ID');
                this.presentToast('Invalid driver ID', 'danger');
                return;
              }

              const message = data.details || `Driver reported a ${issueType} issue.`;
              
              const response = await this.apiService.reportIssue(driverIdNum, issueType, message).toPromise();
              
              if (response.success) {
                this.presentToast('Issue reported successfully to your operator.', 'success');
              } else {
                this.presentToast(response.message || 'Error reporting issue.', 'danger');
              }
            } catch (error) {
              console.error('Error reporting issue:', error);
              this.presentToast('Error reporting issue.', 'danger');
            }
          },
        },
      ],
    });

    await alert.present();
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