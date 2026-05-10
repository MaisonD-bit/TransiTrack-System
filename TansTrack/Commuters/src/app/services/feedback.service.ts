import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class FeedbackService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'ngrok-skip-browser-warning': 'true'
    });
  }

  // Get all feedbacks for the user
  getUserFeedbacks(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/feedbacks/user`,
      { headers: this.getHeaders() }
    );
  }

  // Get feedback by ID
  getFeedbackDetails(feedbackId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/feedbacks/${feedbackId}`,
      { headers: this.getHeaders() }
    );
  }

  // Get pending trips for feedback (trips that are completed but no feedback yet)
  getPendingTripsForFeedback(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/feedbacks/pending-trips`,
      { headers: this.getHeaders() }
    );
  }

  // Submit new feedback
  submitFeedback(feedbackData: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/feedbacks/submit`,
      feedbackData,
      { headers: this.getHeaders() }
    );
  }

  // Update existing feedback
  updateFeedback(feedbackId: string, feedbackData: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/feedbacks/${feedbackId}`,
      feedbackData,
      { headers: this.getHeaders() }
    );
  }

  // Delete feedback
  deleteFeedback(feedbackId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/feedbacks/${feedbackId}`,
      { headers: this.getHeaders() }
    );
  }

  // Get driver ratings
  getDriverRatings(driverId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/drivers/${driverId}/ratings`,
      { headers: this.getHeaders() }
    );
  }

  // Get bus ratings
  getBusRatings(busId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/buses/${busId}/ratings`,
      { headers: this.getHeaders() }
    );
  }
}
