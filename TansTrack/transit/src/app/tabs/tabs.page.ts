import { Component, OnInit, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
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
  private countSub?: Subscription;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.countSub = this.apiService.driverUnreadCount$.subscribe(n => this.unreadCount = n);
    this.pollUnreadCount();
    this.pollTimer = setInterval(() => this.pollUnreadCount(), 15000);
  }

  ngOnDestroy() {
    if (this.pollTimer) clearInterval(this.pollTimer);
    this.countSub?.unsubscribe();
  }

  private pollUnreadCount() {
    const raw = sessionStorage.getItem('driverId');
    if (!raw) return;
    const driverId = parseInt(raw, 10);
    if (isNaN(driverId)) return;

    this.apiService.getDriverNotifications(driverId).subscribe({
      next: (res: any) => {
        if (res?.success && Array.isArray(res.notifications)) {
          this.apiService.driverUnreadCount$.next(
            res.notifications.filter((n: any) => !n.is_read).length
          );
        }
      },
      error: () => {}
    });
  }
}