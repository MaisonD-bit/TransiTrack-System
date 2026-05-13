import { Component, OnInit, OnDestroy } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ToastController, AlertController } from '@ionic/angular';

interface Notification {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
  sender?: {
    name: string;
  };
  schedule?: {
    id: number;
  };
  bus?: {
    bus_number: string;
  };
  assigned_route_label?: string | null;
  schedule_date?: string | null;
  schedule_start_time?: string | null;
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false 
})
export class NotificationsPage implements OnInit, OnDestroy {

  notifications: Notification[] = [];
  loading: boolean = false;
  unreadCount: number = 0;
  private pollTimer: ReturnType<typeof setInterval> | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastController: ToastController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadNotifications();
    // Poll every 15 seconds so the driver sees schedule changes promptly
    this.pollTimer = setInterval(() => this.loadNotifications(), 15000);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  ionViewWillEnter() {
    this.loadNotifications();
  }

  async loadNotifications() {
    this.loading = true;
    const driverId = this.authService.getDriverId();
    // ✅ Convert driverId to number
    const driverIdNum = Number(driverId);
    if (isNaN(driverIdNum)) {
      console.error('Invalid driver ID');
      this.presentToast('Invalid driver ID', 'danger');
      this.loading = false;
      return;
    }

    try {
      const response: any = await firstValueFrom(this.apiService.getDriverNotifications(driverIdNum));
      if (response.success) {
        this.notifications = response.notifications;
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
      } else {
        this.presentToast('Failed to load notifications', 'danger');
      }
    } catch (error) {
      console.error('Error loading notifications:', error);
      this.presentToast('Error loading notifications', 'danger');
    } finally {
      this.loading = false;
    }
  }

  async markAsRead(notification: Notification) {
    if (notification.is_read) return;
    const driverId = this.authService.getDriverId();
    // ✅ Convert driverId to number
    const driverIdNum = Number(driverId);
    if (isNaN(driverIdNum)) {
      console.error('Invalid driver ID');
      this.presentToast('Invalid driver ID', 'danger');
      return;
    }

    try {
      const response: any = await firstValueFrom(this.apiService.markNotificationAsRead(notification.id, driverIdNum));
      if (response.success) {
        notification.is_read = true;
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
        this.apiService.driverUnreadCount$.next(this.unreadCount);
      } else {
        this.presentToast('Failed to mark notification as read', 'danger');
      }
    } catch (error) {
      console.error('Error marking notification as read:', error);
      this.presentToast('Error marking notification as read', 'danger');
    }
  }

  async markAllAsRead() {
    if (this.unreadCount === 0) return;
    const driverIdNum = Number(this.authService.getDriverId());
    if (isNaN(driverIdNum)) {
      this.presentToast('Invalid driver ID', 'danger');
      return;
    }

    try {
      await firstValueFrom(this.apiService.markAllDriverNotificationsAsRead(driverIdNum));
      this.notifications.forEach(n => n.is_read = true);
      this.unreadCount = 0;
      this.apiService.driverUnreadCount$.next(0);
      this.presentToast('All notifications marked as read', 'success');
    } catch (error) {
      this.presentToast('Error marking all notifications as read', 'danger');
    }
  }

  async doRefresh(event: any) {
    await this.loadNotifications();
    event.target.complete();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'schedule_update':
      case 'schedule_cancellation': return 'calendar-outline';
      case 'emergency': return 'alert-circle-outline';
      case 'issue_report': return 'warning-outline';
      case 'inspection_required': return 'wrench-outline';
      case 'terminal_parking_assignment':
      case 'terminal_parking_countdown':
      case 'terminal_parking_extension_pending':
        return 'pin-outline';
      case 'terminal_parking_extension_approved':
        return 'checkmark-circle-outline';
      case 'terminal_parking_extension_denied':
        return 'close-circle-outline';
      default: return 'information-circle-outline';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'schedule_update': return 'success';
      case 'schedule_cancellation': return 'warning';
      case 'emergency': return 'danger';
      case 'issue_report': return 'warning';
      case 'inspection_required': return 'primary';
      case 'terminal_parking_assignment':
      case 'terminal_parking_countdown':
      case 'terminal_parking_extension_pending':
        return 'warning';
      case 'terminal_parking_extension_approved':
        return 'success';
      case 'terminal_parking_extension_denied':
        return 'danger';
      default: return 'medium';
    }
  }

  getNotificationTitle(type: string): string {
    switch (type) {
      case 'schedule_update': return 'Schedule Updated';
      case 'schedule_cancellation': return 'Cancellation Request';
      case 'emergency': return 'Emergency Alert';
      case 'issue_report': return 'Issue Reported';
      case 'inspection_required': return 'Inspection Required';
      case 'terminal_parking_assignment': return 'Terminal bay assigned';
      case 'terminal_parking_countdown': return 'Terminal bay — time remaining';
      case 'terminal_parking_extension_pending': return 'Extension request sent';
      case 'terminal_parking_extension_approved': return 'Extension approved';
      case 'terminal_parking_extension_denied': return 'Extension not granted';
      default: return 'Notification';
    }
  }

  async clearAllNotifications() {
    const alert = await this.alertController.create({
      header: 'Clear All?',
      message: 'This will permanently delete all your notifications.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: () => {
            const driverId = Number(this.authService.getDriverId());
            this.apiService.clearDriverNotifications(driverId).subscribe({
              next: () => {
                this.notifications = [];
                this.unreadCount = 0;
                this.presentToast('All notifications cleared.', 'success');
              },
              error: () => this.presentToast('Failed to clear notifications.', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  deleteNotification(notification: Notification, event: Event) {
    event.stopPropagation();
    this.apiService.deleteDriverNotification(notification.id).subscribe({
      next: () => {
        this.notifications = this.notifications.filter(n => n.id !== notification.id);
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
        this.presentToast('Notification deleted.', 'success');
      },
      error: () => this.presentToast('Failed to delete notification.', 'danger'),
    });
  }

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
    });
    await toast.present();
  }
}