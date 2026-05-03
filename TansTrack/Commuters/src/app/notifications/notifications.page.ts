import { Component, OnInit, OnDestroy } from '@angular/core';
import { NotificationsService } from '../services/notifications.service';
import { Subscription } from 'rxjs';
import { ToastController, LoadingController } from '@ionic/angular';

export interface Notification {
  id: string;
  type: string; // 'booking_confirmation', 'schedule_change', 'bus_arrival', 'driver_arrival', 'promotion'
  title: string;
  message: string;
  description?: string;
  timestamp: string;
  isRead: boolean;
  actionUrl?: string;
  tripId?: string;
  icon?: string;
  bookingDetails?: {
    routeName?: string;
    departureTime?: string;
    bookingReference?: string;
  };
  scheduleChangeDetails?: {
    routeName?: string;
    oldTime?: string;
    newTime?: string;
    reason?: string;
  };
}

@Component({
  selector: 'app-notifications',
  templateUrl: './notifications.page.html',
  styleUrls: ['./notifications.page.scss'],
  standalone: false,
})
export class NotificationsPage implements OnInit, OnDestroy {
  notifications: Notification[] = [];
  displayedNotifications: Notification[] = [];
  selectedNotification: Notification | null = null;
  showDetails: boolean = false;
  
  isLoading: boolean = false;
  filterType: string = 'all'; // all, booking_confirmation, schedule_change, unread
  searchQuery: string = '';
  unreadCount: number = 0;

  private subscriptions: Subscription[] = [];

  constructor(
    private notificationsService: NotificationsService,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.loadNotifications();
    // Listen for real-time notifications
    this.subscribeToRealTimeNotifications();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async loadNotifications() {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Loading notifications...'
    });
    await loading.present();

    const sub = this.notificationsService.getUserNotifications().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.notifications = response.data;
          this.updateUnreadCount();
          this.applyFilters();
        }
        this.isLoading = false;
        loading.dismiss();
      },
      error: (error: any) => {
        console.error('Error loading notifications:', error);
        this.showToast('Failed to load notifications', 'danger');
        this.isLoading = false;
        loading.dismiss();
      }
    });

    this.subscriptions.push(sub);
  }

  subscribeToRealTimeNotifications() {
    const sub = this.notificationsService.getRealTimeNotifications().subscribe({
      next: (notification: Notification) => {
        console.log('New notification received:', notification);
        this.notifications.unshift(notification);
        this.updateUnreadCount();
        this.applyFilters();
        this.showToast(notification.title, 'info');
      },
      error: (error: any) => {
        console.error('Error in notification subscription:', error);
      }
    });

    this.subscriptions.push(sub);
  }

  updateUnreadCount() {
    this.unreadCount = this.notifications.filter(n => !n.isRead).length;
  }

  applyFilters() {
    let filtered = this.notifications.filter(notification => {
      let typeMatch = true;
      if (this.filterType === 'unread') {
        typeMatch = !notification.isRead;
      } else if (this.filterType !== 'all') {
        typeMatch = notification.type === this.filterType;
      }

      const searchMatch = this.searchQuery === '' || 
        notification.title.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        notification.message.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      return typeMatch && searchMatch;
    });

    // Sort by most recent first
    filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    this.displayedNotifications = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  onSearchChange() {
    this.applyFilters();
  }

  selectNotification(notification: Notification) {
    this.selectedNotification = notification;
    this.showDetails = true;
    
    // Mark as read
    if (!notification.isRead) {
      this.markAsRead(notification.id);
    }
  }

  closeDetails() {
    this.showDetails = false;
    this.selectedNotification = null;
  }

  markAsRead(notificationId: string) {
    const sub = this.notificationsService.markNotificationAsRead(notificationId).subscribe({
      next: (response: any) => {
        if (response.success) {
          const notification = this.notifications.find(n => n.id === notificationId);
          if (notification) {
            notification.isRead = true;
            this.updateUnreadCount();
            this.applyFilters();
          }
        }
      },
      error: (error: any) => {
        console.error('Error marking notification as read:', error);
      }
    });

    this.subscriptions.push(sub);
  }

  markAllAsRead() {
    const sub = this.notificationsService.markAllNotificationsAsRead().subscribe({
      next: (response: any) => {
        if (response.success) {
          this.notifications.forEach(n => n.isRead = true);
          this.updateUnreadCount();
          this.applyFilters();
          this.showToast('All notifications marked as read', 'success');
        }
      },
      error: (error: any) => {
        console.error('Error marking all as read:', error);
      }
    });

    this.subscriptions.push(sub);
  }

  deleteNotification(notificationId: string) {
    const sub = this.notificationsService.deleteNotification(notificationId).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.notifications = this.notifications.filter(n => n.id !== notificationId);
          this.updateUnreadCount();
          this.applyFilters();
          this.showToast('Notification deleted', 'success');
        }
      },
      error: (error: any) => {
        console.error('Error deleting notification:', error);
      }
    });

    this.subscriptions.push(sub);
  }

  getNotificationIcon(type: string): string {
    switch (type) {
      case 'booking_confirmation':
        return 'checkmark-circle';
      case 'schedule_change':
        return 'alert-circle';
      case 'bus_arrival':
        return 'bus';
      case 'driver_arrival':
        return 'person';
      case 'promotion':
        return 'gift';
      default:
        return 'notifications';
    }
  }

  getNotificationColor(type: string): string {
    switch (type) {
      case 'booking_confirmation':
        return 'success';
      case 'schedule_change':
        return 'warning';
      case 'bus_arrival':
        return 'primary';
      case 'driver_arrival':
        return 'info';
      case 'promotion':
        return 'tertiary';
      default:
        return 'medium';
    }
  }

  getRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = (now.getTime() - date.getTime()) / 1000;

    if (seconds < 60) {
      return 'just now';
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ago`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(seconds / 86400);
      return `${days}d ago`;
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
