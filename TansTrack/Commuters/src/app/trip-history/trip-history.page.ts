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
  showReceipt = false;
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

    this.trips = this.tripHistoryService.getLocalTripsSync();
    this.applyFiltersAndSort();
    this.isLoading = false;
    loading.dismiss();
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
    this.showReceipt = false;
    this.selectedTrip = null;
  }

  openReceipt(): void {
    if (!this.selectedTrip) return;
    this.showReceipt = true;
  }

  closeReceipt(): void {
    this.showReceipt = false;
  }

  getReceiptPaidAt(trip: Trip): string {
    const receipt = this.getReceipt(trip.id);
    if (receipt?.paidAt) {
      return new Date(receipt.paidAt).toLocaleString('en-PH', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    }
    return this.formatTripDate(trip.tripDate);
  }

  getReceiptReference(trip: Trip): string {
    const receipt = this.getReceipt(trip.id);
    return receipt?.transactionRef || trip.id || '—';
  }

  getReceiptPaymentMethod(trip: Trip): string {
    const receipt = this.getReceipt(trip.id);
    return receipt?.paymentMethod || trip.paymentMethod || 'Cash';
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

  getReceipt(tripId: string): any {
    try {
      const raw = localStorage.getItem(`receipt_${tripId}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  openReceiptFromDetails(): void {
    this.openReceipt();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'completed': return 'success';
      case 'paid': return 'success';
      case 'cancelled': return 'danger';
      case 'in-progress': return 'warning';
      default: return 'medium';
    }
  }

  getStatusLabel(status: string): string {
    switch (status) {
      case 'paid': return 'PAID';
      case 'in-progress': return 'ACTIVE';
      default: return status.toUpperCase();
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

  async clearAllTrips() {
    const alert = await this.alertController.create({
      header: 'Clear All Trips?',
      message: 'This will remove all locally saved trip history.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: () => {
            this.tripHistoryService.clearLocalTrips();
            this.trips = [];
            this.displayedTrips = [];
            void this.showToast('Trip history cleared.', 'success');
          },
        },
      ],
    });
    await alert.present();
  }

  deleteTrip(trip: Trip, event: Event) {
    event.stopPropagation();
    this.tripHistoryService.deleteLocalTrip(trip.id);
    this.trips = this.trips.filter(t => t.id !== trip.id);
    this.applyFiltersAndSort();
    void this.showToast('Trip removed.', 'success');
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
