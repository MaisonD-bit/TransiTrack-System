import { Component, OnInit, OnDestroy } from '@angular/core';
import { TripHistoryService } from '../services/trip-history.service';
import { CommuterService } from '../services/commuter.service';
import { Subscription } from 'rxjs';
import { ToastController, LoadingController, AlertController, ViewWillEnter } from '@ionic/angular';

export interface Trip {
  id: string;
  routeName: string;
  departure: string;
  arrival: string;
  departureTime: string;
  arrivalTime: string;
  fare: number;
  paymentMethod: string;
  status: string; // 'completed', 'cancelled', 'in-progress'
  driverName: string;
  busPlateNumber: string;
  tripDate: string;
  distance: number;
  duration: string;
}

@Component({
  selector: 'app-trip-history',
  templateUrl: './trip-history.page.html',
  styleUrls: ['./trip-history.page.scss'],
  standalone: false,
})
export class TripHistoryPage implements OnInit, OnDestroy, ViewWillEnter {
  trips: Trip[] = [];
  displayedTrips: Trip[] = [];
  selectedTrip: Trip | null = null;
  showDetails: boolean = false;
  isLoading: boolean = false;
  filterStatus: string = 'all'; // all, completed, cancelled, in-progress
  searchQuery: string = '';
  sortBy: string = 'recent'; // recent, oldest, cost-high, cost-low
  
  private subscriptions: Subscription[] = [];

  constructor(
    private tripHistoryService: TripHistoryService,
    private commuterService: CommuterService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {}

  ionViewWillEnter() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.subscriptions = [];
    this.loadTrips();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async loadTrips() {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Loading trip history...'
    });
    await loading.present();

    const sub = this.tripHistoryService.getUserTrips().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.trips = response.data;
        }
        // Merge any locally saved trips not already in the list
        const localTrips = this.tripHistoryService.getLocalTripsSync();
        const existingIds = new Set(this.trips.map((t: Trip) => t.id));
        localTrips.forEach((t: any) => { if (!existingIds.has(t.id)) this.trips.push(t); });
        this.applyFiltersAndSort();
        this.isLoading = false;
        loading.dismiss();
      },
      error: () => {
        // API unavailable — show locally saved trips
        const localSub = this.tripHistoryService.getLocalTrips().subscribe({
          next: (response: any) => {
            if (response.success && response.data) {
              this.trips = response.data;
              this.applyFiltersAndSort();
            }
          }
        });
        this.subscriptions.push(localSub);
        this.isLoading = false;
        loading.dismiss();
      }
    });

    this.subscriptions.push(sub);
  }

  /** Safe for ISO strings or pre-formatted times (avoids DatePipe on "11:01 PM"). */
  formatTripTime(raw: unknown): string {
    if (raw == null || raw === '') return '—';
    const d = new Date(raw as string);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
    }
    return String(raw);
  }

  formatTripDate(raw: unknown): string {
    if (raw == null || raw === '') return '—';
    const d = new Date(raw as string);
    if (!Number.isNaN(d.getTime())) {
      return d.toLocaleDateString('en-PH', { month: 'short', day: '2-digit', year: 'numeric' });
    }
    return String(raw);
  }

  applyFiltersAndSort() {
    // Apply filters
    let filtered = this.trips.filter(trip => {
      const statusMatch = this.filterStatus === 'all' || trip.status === this.filterStatus;
      const searchMatch = this.searchQuery === '' || 
        trip.routeName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        trip.departure.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        trip.arrival.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      return statusMatch && searchMatch;
    });

    // Apply sorting
    filtered.sort((a, b) => {
      switch (this.sortBy) {
        case 'oldest':
          return new Date(a.tripDate).getTime() - new Date(b.tripDate).getTime();
        case 'cost-high':
          return b.fare - a.fare;
        case 'cost-low':
          return a.fare - b.fare;
        case 'recent':
        default:
          return new Date(b.tripDate).getTime() - new Date(a.tripDate).getTime();
      }
    });

    this.displayedTrips = filtered;
  }

  onFilterChange() {
    this.applyFiltersAndSort();
  }

  onSortChange() {
    this.applyFiltersAndSort();
  }

  onSearchChange() {
    this.applyFiltersAndSort();
  }

  selectTrip(trip: Trip) {
    this.selectedTrip = trip;
    this.showDetails = true;
  }

  closeDetails() {
    this.showDetails = false;
    this.selectedTrip = null;
  }

  async shareTripInfo() {
    if (!this.selectedTrip) return;

    const tripInfo = `
Trip Details:
Route: ${this.selectedTrip.routeName}
Date: ${this.selectedTrip.tripDate}
From: ${this.selectedTrip.departure}
To: ${this.selectedTrip.arrival}
Departure: ${this.selectedTrip.departureTime}
Arrival: ${this.selectedTrip.arrivalTime}
Fare: ₱${this.selectedTrip.fare}
Distance: ${this.selectedTrip.distance} km
Duration: ${this.selectedTrip.duration}
Status: ${this.selectedTrip.status}
    `;

    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Trip Receipt',
          text: tripInfo
        });
      } else {
        await this.copyToClipboard(tripInfo);
      }
    } catch (error) {
      console.error('Error sharing trip info:', error);
    }
  }

  async copyToClipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      this.showToast('Trip details copied to clipboard', 'success');
    } catch (error) {
      console.error('Error copying to clipboard:', error);
      this.showToast('Failed to copy to clipboard', 'danger');
    }
  }

  async downloadReceipt() {
    if (!this.selectedTrip) return;
    
    try {
      const response = await this.tripHistoryService.downloadReceipt(this.selectedTrip.id).toPromise();
      if (response) {
        // Handle PDF download
        const blob = new Blob([response], { type: 'application/pdf' });
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.download = `Receipt-${this.selectedTrip.id}.pdf`;
        link.click();
        window.URL.revokeObjectURL(url);
        this.showToast('Receipt downloaded', 'success');
      }
    } catch (error) {
      console.error('Error downloading receipt:', error);
      this.showToast('Failed to download receipt', 'danger');
    }
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed':
        return 'success';
      case 'cancelled':
        return 'danger';
      case 'in-progress':
        return 'warning';
      default:
        return 'medium';
    }
  }

  async markTripAsArrived(trip: Trip) {
    const confirm = await this.alertController.create({
      header: 'Mark trip complete?',
      message: 'Use this when you have reached your stop. Your seat will be released on the operator side.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: "I've arrived",
          handler: () => {
            this.commuterService.alight(trip.id).subscribe({
              error: (e) => console.warn('alight failed', e),
            });
            const arrived = new Date().toISOString();
            const dep = new Date(trip.departureTime as string).getTime();
            const arr = new Date(arrived).getTime();
            let duration = '';
            if (!Number.isNaN(dep) && !Number.isNaN(arr) && arr > dep) {
              const mins = Math.round((arr - dep) / 60000);
              duration = mins < 60 ? `${mins} min` : `${Math.floor(mins / 60)}h ${mins % 60}m`;
            }
            this.tripHistoryService.updateLocalTrip(trip.id, {
              status: 'completed',
              arrivalTime: arrived,
              duration,
            });
            void this.showToast('Trip marked complete.', 'success');
            this.closeDetails();
            this.loadTrips();
          },
        },
      ],
    });
    await confirm.present();
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
