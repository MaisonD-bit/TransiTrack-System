import { Component, OnInit, OnDestroy } from '@angular/core';
import { Router } from '@angular/router';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { LoadingController, AlertController, ToastController } from '@ionic/angular';
import { Subscription } from 'rxjs';

interface RouteGeometry {
  type: string;
  coordinates: [number, number][];
}

interface Schedule {
  id: number;
  route_id: number;
  driver_id: number;
  bus_id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  fare_regular?: number;
  fare_aircon?: number;
  notes?: string;
  route?: {
    id: number;
    name: string;
    start_location: string;
    end_location: string;
    distance_km?: number;
    estimated_duration?: number;
    geometry?: RouteGeometry;
  };
  bus?: {
    id: number;
    bus_number: string;
    model: string;
    is_aircon?: boolean;
  };
  created_at: string;
  updated_at: string;
}

interface Summary {
  today_schedules: number;
  future_schedules: number;
  past_schedules: number;
  active_today: number;
  completed_today: number;
  pending_action: number;
}

@Component({
  selector: 'app-schedule',
  templateUrl: './schedule.page.html',
  styleUrls: ['./schedule.page.scss'],
  standalone: false
})
export class SchedulePage implements OnInit, OnDestroy {
  schedules: Schedule[] = [];
  todaySchedules: Schedule[] = [];
  upcomingSchedules: Schedule[] = [];
  pastSchedules: Schedule[] = [];
  completedSchedules: Schedule[] = [];
  isLoading: boolean = false;
  error: string = '';
  driverId: string = '';
  selectedSegment: string = 'today';
  summary: Summary = {
    today_schedules: 0,
    future_schedules: 0,
    past_schedules: 0,
    active_today: 0,
    completed_today: 0,
    pending_action: 0
  };
  
  private subscription?: Subscription;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private loadingController: LoadingController,
    private alertController: AlertController,
    private toastController: ToastController,
    private router: Router
  ) {}

  ngOnInit() {
    const driverId = this.authService.getDriverId();

    if (!driverId) {
      console.error('No driver ID found - redirecting to login');
      this.router.navigate(['/login']);
      return;
    }

    this.driverId = driverId;
    console.log(`Schedule page initialized for driver ID: ${this.driverId}`);
    this.loadSchedules();
  }

  ngOnDestroy() {
    if (this.subscription) {
      this.subscription.unsubscribe();
    }
  }

  onSegmentChanged(event: any) {
    this.selectedSegment = event.detail.value;
    console.log('Segment changed to:', this.selectedSegment);
  }

  async loadSchedules() {
    if (!this.driverId) {
      console.error('No driver ID - user not logged in');
      this.router.navigate(['/login']);
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Loading your schedules...',
      duration: 10000
    });
    await loading.present();

    this.isLoading = true;
    this.error = '';

    try {
      const driverIdNum = parseInt(this.driverId, 10);
      if (isNaN(driverIdNum)) {
        throw new Error("Invalid driver ID format");
      }
      
      console.log(`Loading schedules for logged-in driver ${driverIdNum}`);
      
      this.subscription = this.apiService.getDriverSchedules(driverIdNum).subscribe({
        next: (response) => {
          console.log('Schedules response:', response);
          
          if (response.success && response.schedules) {
            // Get all schedules
            this.schedules = response.schedules.all || [];
            
            // Get categorized schedules from API
            this.todaySchedules = response.schedules.today || [];
            this.upcomingSchedules = response.schedules.upcoming || [];
            this.pastSchedules = response.schedules.past || [];
            
            // Also get completed schedules
            this.completedSchedules = this.schedules.filter(s => s.status === 'completed');
            
            this.updateSummary();
            console.log(`Loaded ${this.schedules.length} total schedules for driver ${this.driverId}`);
            console.log(`Today: ${this.todaySchedules.length}, Upcoming: ${this.upcomingSchedules.length}, Past: ${this.pastSchedules.length}`);
          } else {
            this.error = 'No schedules found for your account';
            console.log('No schedules found for this driver');
          }
        },
        error: (error) => {
          console.error('Error loading schedules:', error);
          this.error = 'Failed to load your schedules. Please try again.';
          this.presentToast('Failed to load schedules', 'danger');
        }
      });
      
    } catch (error) {
      console.error('Error in loadSchedules:', error);
      this.error = 'Error loading schedules';
      this.presentToast('Error loading schedules', 'danger');
    } finally {
      this.isLoading = false;
      await loading.dismiss();
    }
  }

  private updateSummary() {
    const todaySchedules = this.todaySchedules || [];
    const upcomingSchedules = this.upcomingSchedules || [];
    const pastSchedules = this.pastSchedules || [];

    // Count active and completed for today
    const activeToday = todaySchedules.filter(s => s.status === 'active').length;
    const completedToday = todaySchedules.filter(s => s.status === 'completed').length;

    // Count schedules that need action (scheduled status)
    const pendingAction = this.schedules.filter(s => s.status === 'scheduled').length;

    this.summary = {
      today_schedules: todaySchedules.length,
      future_schedules: upcomingSchedules.length,
      past_schedules: pastSchedules.length,
      active_today: activeToday,
      completed_today: completedToday,
      pending_action: pendingAction
    };

    console.log('Summary updated:', this.summary);
  }

  getRouteDetails(schedule: Schedule): string {
    return schedule.route?.name || `Route ${schedule.route_id}`;
  }

  getBusDetails(schedule: Schedule): string {
    if (schedule.bus) {
      return `${schedule.bus.bus_number} - ${schedule.bus.model}`;
    }
    return `Bus ${schedule.bus_id}`;
  }

  canAccept(schedule: Schedule): boolean {
    return schedule.status === 'scheduled';
  }

  canDecline(schedule: Schedule): boolean {
    return schedule.status === 'scheduled';
  }

  canStart(schedule: Schedule): boolean {
    return schedule.status === 'accepted';
  }

  canComplete(schedule: Schedule): boolean {
    return schedule.status === 'active';
  }

  async acceptSchedule(schedule: Schedule) {
    const alert = await this.alertController.create({
      header: 'Accept Schedule',
      message: `Accept the schedule for ${schedule.route?.name}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Accept',
          handler: async () => {
            try {
              const response = await this.apiService.post(`schedules/${schedule.id}/accept`, {}).toPromise();
              if (response && response.success) {
                await this.loadSchedules();
                await this.presentToast('Schedule accepted successfully!', 'success');
              }
            } catch (error) {
              console.error('Error accepting schedule:', error);
              await this.presentToast('Failed to accept schedule', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async declineSchedule(schedule: Schedule) {
    const alert = await this.alertController.create({
      header: 'Decline Schedule',
      message: `Decline the schedule for ${schedule.route?.name}?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Decline',
          handler: async () => {
            try {
              const response = await this.apiService.declineSchedule(schedule.id).toPromise();
              if (response.success) {
                await this.loadSchedules();
                await this.presentToast('Schedule declined', 'warning');
              }
            } catch (error) {
              console.error('Error declining schedule:', error);
              await this.presentToast('Failed to decline schedule', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async startSchedule(schedule: Schedule) {
    try {
      const response = await this.apiService.startSchedule(schedule.id).toPromise();
      if (response.success) {
        await this.loadSchedules();
        
        await this.presentToast('Trip started successfully! Navigating to route map...', 'success');

        console.log('Navigating to map page for schedule:', schedule.id);
        console.log('Route geometry available:', schedule.route?.geometry ? 'Yes' : 'No');
        
        this.router.navigate(['/map'], {
          queryParams: {
            scheduleId: schedule.id,
            routeId: schedule.route?.id
          }
        });
      }
    } catch (error) {
      console.error('Error starting schedule:', error);
      await this.presentToast('Failed to start trip', 'danger');
    }
  }

  async completeSchedule(schedule: Schedule) {
    const alert = await this.alertController.create({
      header: 'Complete Trip',
      message: `Mark this trip as completed?`,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Complete',
          handler: async () => {
            try {
              const response = await this.apiService.completeSchedule(schedule.id).toPromise();
              if (response.success) {
                await this.loadSchedules();
                await this.presentToast('Trip completed successfully!', 'success');
              }
            } catch (error) {
              console.error('Error completing schedule:', error);
              await this.presentToast('Failed to complete trip', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  getStatusColor(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'success';
      case 'scheduled': return 'primary';
      case 'accepted': return 'secondary';
      case 'completed': return 'medium';
      case 'declined':
      case 'cancelled': return 'danger';
      default: return 'medium';
    }
  }

  getStatusIcon(status: string): string {
    switch (status?.toLowerCase()) {
      case 'active': return 'radio-button-on';
      case 'scheduled': return 'time';
      case 'accepted': return 'checkmark-circle';
      case 'completed': return 'checkmark-done-circle';
      case 'declined': return 'close-circle';
      case 'cancelled': return 'ban';
      default: return 'help-circle';
    }
  }

  formatTime(timeString: string): string {
    try {
      const [hours, minutes] = timeString.split(':');
      const date = new Date();
      date.setHours(parseInt(hours), parseInt(minutes));
      return date.toLocaleTimeString('en-US', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: true
      });
    } catch {
      return timeString;
    }
  }

  formatDate(dateString: string): string {
    try {
      const date = new Date(dateString);
      const today = new Date();
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);

      // Check if it's today
      if (date.toDateString() === today.toDateString()) {
        return 'Today';
      }
      
      // Check if it's tomorrow
      if (date.toDateString() === tomorrow.toDateString()) {
        return 'Tomorrow';
      }

      return date.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric',
        year: date.getFullYear() !== today.getFullYear() ? 'numeric' : undefined
      });
    } catch {
      return dateString;
    }
  }

  async refreshSchedules(event?: any) {
    await this.loadSchedules();
    if (event) {
      event.target.complete();
    }
  }

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
      position: 'bottom'
    });
    await toast.present();
  }
}