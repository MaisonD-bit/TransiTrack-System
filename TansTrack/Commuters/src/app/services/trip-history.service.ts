import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class TripHistoryService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'ngrok-skip-browser-warning': 'true'
    });
  }

  // Get user's trip history
  getUserTrips(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/trips/history`,
      { headers: this.getHeaders() }
    );
  }

  // Get trip details by ID
  getTripDetails(tripId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/trips/${tripId}`,
      { headers: this.getHeaders() }
    );
  }

  // Download receipt for a trip
  downloadReceipt(tripId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/trips/${tripId}/receipt`,
      { headers: this.getHeaders(), responseType: 'blob' as 'json' }
    );
  }

  // Get transaction history
  getTransactionHistory(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/transactions/history`,
      { headers: this.getHeaders() }
    );
  }

  // Get transactions by date range
  getTransactionsByDateRange(startDate: string, endDate: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/transactions/range?start=${startDate}&end=${endDate}`,
      { headers: this.getHeaders() }
    );
  }

  // Get transaction details
  getTransactionDetails(transactionId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/transactions/${transactionId}`,
      { headers: this.getHeaders() }
    );
  }

  // Export trips as CSV
  exportTripsAsCSV(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/trips/export/csv`,
      { headers: this.getHeaders(), responseType: 'blob' as 'json' }
    );
  }

  saveLocalTrip(trip: any): void {
    const trips = this.getLocalTripsSync();
    trips.unshift(trip);
    localStorage.setItem('localTrips', JSON.stringify(trips));
  }

  getLocalTripsSync(): any[] {
    try {
      const stored = localStorage.getItem('localTrips');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  getLocalTrips(): Observable<any> {
    return of({ success: true, data: this.getLocalTripsSync() });
  }
}
