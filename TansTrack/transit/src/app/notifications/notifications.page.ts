import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ToastController } from '@ionic/angular';

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
export class NotificationsPage implements OnInit {

  notifications: Notification[] = [];
  loading: boolean = false;
  unreadCount: number = 0;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ngOnInit() {
    this.loadNotifications();
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
      const response: any = await this.apiService.getDriverNotifications(driverIdNum).toPromise();
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
      const response: any = await this.apiService.markNotificationAsRead(notification.id, driverIdNum).toPromise();
      if (response.success) {
        notification.is_read = true;
        this.unreadCount = this.notifications.filter(n => !n.is_read).length;
        this.presentToast('Notification marked as read', 'success');
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
    const driverId = this.authService.getDriverId();
    // ✅ Convert driverId to number
    const driverIdNum = Number(driverId);
    if (isNaN(driverIdNum)) {
      console.error('Invalid driver ID');
      this.presentToast('Invalid driver ID', 'danger');
      return;
    }

    try {
      // Assuming you have an API method for marking all as read
      // const response: any = await this.apiService.markAllNotificationsAsRead(driverIdNum).toPromise();
      // For now, simulate the action on the frontend
      this.notifications.forEach(n => n.is_read = true);
      this.unreadCount = 0;
      this.presentToast('All notifications marked as read', 'success');
    } catch (error) {
      console.error('Error marking all notifications as read:', error);
      this.presentToast('Error marking all notifications as read', 'danger');
    }
  }

  async doRefresh(event: any) {
    await this.loadNotifications();
    event.target.complete();
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'schedule_update': return 'calendar-outline';
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

  async presentToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 2000,
      color: color,
    });
    await toast.present();
  }
}