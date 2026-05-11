import { Component } from '@angular/core';
import { ToastController, ViewWillEnter } from '@ionic/angular';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-performance',
  templateUrl: './performance.page.html',
  styleUrls: ['./performance.page.scss'],
  standalone: false,
})
export class PerformancePage implements ViewWillEnter {
  isLoading = false;
  kpi: any = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  ionViewWillEnter() {
    this.loadPerformance();
  }

  async loadPerformance() {
    const driverId = Number(this.authService.getDriverId());
    if (!driverId) return;

    this.isLoading = true;
    this.apiService.getDriverPerformance(driverId).subscribe({
      next: (res: any) => {
        if (res.success) this.kpi = res.data;
        this.isLoading = false;
      },
      error: async () => {
        this.isLoading = false;
        const t = await this.toastController.create({
          message: 'Could not load performance data.',
          duration: 2500, color: 'danger'
        });
        await t.present();
      }
    });
  }

  ratingStars(rating: number | null): number[] {
    const r = Math.round(rating ?? 0);
    return Array.from({ length: 5 }, (_, i) => i < r ? 1 : 0);
  }
}
