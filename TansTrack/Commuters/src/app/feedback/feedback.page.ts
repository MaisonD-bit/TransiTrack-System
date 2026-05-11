import { Component, OnInit, OnDestroy } from '@angular/core';
import { FeedbackService } from '../services/feedback.service';
import { Subscription } from 'rxjs';
import { ToastController, LoadingController, AlertController } from '@ionic/angular';


export interface Feedback {
  id: string;
  tripId: string;
  routeName: string;
  driverName: string;
  busPlateNumber: string;
  tripDate: string;
  driverRating: number;
  serviceRating: number;
  cleanlinessRating: number;
  safetyRating: number;
  comment: string;
  status: string; // 'submitted', 'pending'
  submittedDate?: string;
}

@Component({
  selector: 'app-feedback',
  templateUrl: './feedback.page.html',
  styleUrls: ['./feedback.page.scss'],
  standalone: false,
})
export class FeedbackPage implements OnInit, OnDestroy {
  feedbacks: Feedback[] = [];
  displayedFeedbacks: Feedback[] = [];
  selectedFeedback: Feedback | null = null;
  showFeedbackForm: boolean = false;
  showFeedbackDetail: boolean = false;
  
  isLoading: boolean = false;
  isSubmitting: boolean = false;
  searchQuery: string = '';
  filterStatus: string = 'all';

  // Form data
  newFeedback = {
    tripId: '',
    driverRating: 5,
    serviceRating: 5,
    cleanlinessRating: 5,
    safetyRating: 5,
    comment: ''
  };

  pendingTrips: any[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private feedbackService: FeedbackService,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private alertController: AlertController
  ) {}

  ngOnInit() {
    this.loadFeedbacks();
    this.loadPendingTrips();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async loadFeedbacks() {
    this.isLoading = true;
    const loading = await this.loadingController.create({
      message: 'Loading feedbacks...'
    });
    await loading.present();

    const commuterId = this.getCommuterId();
    const sub = this.feedbackService.getUserFeedbacks(commuterId).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.feedbacks = response.data;
          this.applyFilters();
        }
        this.isLoading = false;
        loading.dismiss();
      },
      error: (error) => {
        console.error('Error loading feedbacks:', error);
        this.showToast('Failed to load feedbacks', 'danger');
        this.isLoading = false;
        loading.dismiss();
      }
    });

    this.subscriptions.push(sub);
  }

  loadPendingTrips() {
    const sub = this.feedbackService.getPendingTripsForFeedback(this.getCommuterId()).subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.pendingTrips = response.data;
        }
      },
      error: (error) => {
        console.error('Error loading pending trips:', error);
      }
    });

    this.subscriptions.push(sub);
  }

  applyFilters() {
    let filtered = this.feedbacks.filter(fb => {
      const statusMatch = this.filterStatus === 'all' || fb.status === this.filterStatus;
      const searchMatch = this.searchQuery === '' || 
        fb.routeName.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
        fb.driverName.toLowerCase().includes(this.searchQuery.toLowerCase());
      
      return statusMatch && searchMatch;
    });

    this.displayedFeedbacks = filtered;
  }

  onFilterChange() {
    this.applyFilters();
  }

  onSearchChange() {
    this.applyFilters();
  }

  openFeedbackForm() {
    if (this.pendingTrips.length === 0) {
      this.showToast('No pending trips to provide feedback for', 'info');
      return;
    }
    this.showFeedbackForm = true;
    this.newFeedback = {
      tripId: '',
      driverRating: 5,
      serviceRating: 5,
      cleanlinessRating: 5,
      safetyRating: 5,
      comment: ''
    };
  }

  closeFeedbackForm() {
    this.showFeedbackForm = false;
  }

  async submitFeedback() {
    if (!this.newFeedback.tripId) {
      this.showToast('Please select a trip', 'warning');
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Submitting feedback...'
    });
    await loading.present();

    const feedbackData = {
      commuter_id: this.getCommuterId() || undefined,
      public_ticket_id: this.newFeedback.tripId,
      driver_rating: this.newFeedback.driverRating,
      service_rating: this.newFeedback.serviceRating,
      cleanliness_rating: this.newFeedback.cleanlinessRating,
      safety_rating: this.newFeedback.safetyRating,
      comment: this.newFeedback.comment
    };

    const sub = this.feedbackService.submitFeedback(feedbackData).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.showToast('Feedback submitted successfully!', 'success');
          this.closeFeedbackForm();
          this.loadFeedbacks();
          this.loadPendingTrips();
        }
        this.isSubmitting = false;
        loading.dismiss();
      },
      error: (error) => {
        console.error('Error submitting feedback:', error);
        this.showToast('Failed to submit feedback', 'danger');
        this.isSubmitting = false;
        loading.dismiss();
      }
    });

    this.subscriptions.push(sub);
  }

  selectFeedback(feedback: Feedback) {
    this.selectedFeedback = feedback;
    this.showFeedbackDetail = true;
  }

  closeFeedbackDetail() {
    this.showFeedbackDetail = false;
    this.selectedFeedback = null;
  }

  getAverageRating(feedback: Feedback): number {
    const ratings = [feedback.driverRating, feedback.serviceRating, feedback.cleanlinessRating, feedback.safetyRating]
      .filter(r => r > 0);
    if (ratings.length === 0) return 0;
    return ratings.reduce((sum, r) => sum + r, 0) / ratings.length;
  }

  getRatingColor(rating: number): string {
    if (rating >= 4) return 'success';
    if (rating >= 3) return 'warning';
    return 'danger';
  }

  async clearAllFeedbacks() {
    const alert = await this.alertController.create({
      header: 'Clear All Feedback?',
      message: 'This will permanently delete all your submitted feedback.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Clear All',
          role: 'destructive',
          handler: () => {
            this.feedbackService.clearAllFeedbacks(this.getCommuterId()).subscribe({
              next: () => {
                this.feedbacks = [];
                this.displayedFeedbacks = [];
                this.showToast('All feedback cleared.', 'success');
              },
              error: () => this.showToast('Failed to clear feedback.', 'danger'),
            });
          },
        },
      ],
    });
    await alert.present();
  }

  deleteFeedback(feedback: Feedback, event: Event) {
    event.stopPropagation();
    this.feedbackService.deleteFeedback(feedback.id).subscribe({
      next: () => {
        this.feedbacks = this.feedbacks.filter(f => f.id !== feedback.id);
        this.applyFilters();
        this.showToast('Feedback deleted.', 'success');
      },
      error: () => this.showToast('Failed to delete feedback.', 'danger'),
    });
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

  private getCommuterId(): number {
    try {
      const raw = sessionStorage.getItem('currentUser');
      if (!raw) return 0;
      const u = JSON.parse(raw);
      return Number(u.id ?? u.commuter_id ?? 0);
    } catch {
      return 0;
    }
  }
}
