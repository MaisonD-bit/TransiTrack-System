import { Component, OnInit, OnDestroy } from '@angular/core';
import { ApiService } from '../services/api.service';

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false
})
export class TabsPage implements OnInit, OnDestroy {
  unreadCount: number = 0;
  private pollTimer?: ReturnType<typeof setInterval>;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.pollUnreadCount();
    this.pollTimer = setInterval(() => this.pollUnreadCount(), 15000);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
  }

  private pollUnreadCount() {
    // sessionStorage is tab-isolated — each tab has its own logged-in driver
    const raw = sessionStorage.getItem('driverId');
    if (!raw) return;
    const driverId = parseInt(raw, 10);
    if (isNaN(driverId)) return;

    this.apiService.getDriverNotifications(driverId).subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.notifications)) {
          this.unreadCount = res.notifications.filter((n: any) => !n.is_read).length;
        }
      },
      error: () => { /* ignore — badge just stays at 0 */ }
    });
  }
}