import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({ providedIn: 'root' })
export class FeedbackService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) {}

  private get headers(): HttpHeaders {
    return new HttpHeaders({ 'ngrok-skip-browser-warning': 'true' });
  }

  submitFeedback(data: {
    commuter_id?: number;
    public_ticket_id?: string;
    driver_rating?: number;
    service_rating?: number;
    cleanliness_rating?: number;
    safety_rating?: number;
    comment?: string;
  }): Observable<any> {
    return this.http.post<any>(`${this.apiUrl}/feedbacks`, data, { headers: this.headers });
  }

  getPendingTripsForFeedback(commuterId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/feedbacks/pending?commuter_id=${commuterId}`, { headers: this.headers });
  }

  getUserFeedbacks(commuterId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/feedbacks/commuter?commuter_id=${commuterId}`, { headers: this.headers });
  }

  getDriverRatings(driverId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/feedbacks/driver/${driverId}`, { headers: this.headers });
  }

  deleteFeedback(id: string): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/feedbacks/${id}`, { headers: this.headers });
  }

  clearAllFeedbacks(commuterId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/feedbacks?commuter_id=${commuterId}`, { headers: this.headers });
  }
}
