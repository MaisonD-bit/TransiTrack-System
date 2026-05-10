import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, Subject } from 'rxjs';
import { environment } from '../../environments/environment';
import { webSocket } from 'rxjs/webSocket';

@Injectable({
  providedIn: 'root'
})
export class NotificationsService {
  private apiUrl = environment.apiUrl;
  private wsUrl = environment.apiUrl.replace('http', 'ws'); // Convert HTTP to WS
  private notificationSubject = new Subject<any>();

  constructor(private http: HttpClient) {
    this.initializeWebSocket();
  }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'ngrok-skip-browser-warning': 'true'
    });
  }

  private initializeWebSocket() {
    // Initialize WebSocket connection for real-time notifications
    // This will be established based on your backend WebSocket implementation
    try {
      // Placeholder: WebSocket implementation can be added here
      // const socket = webSocket(`${this.wsUrl}/notifications`);
      // socket.subscribe(
      //   (notification: any) => {
      //     this.notificationSubject.next(notification);
      //   }
      // );
    } catch (error) {
      console.error('WebSocket connection error:', error);
    }
  }

  // Get all notifications for the user
  getUserNotifications(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/notifications`,
      { headers: this.getHeaders() }
    );
  }

  // Get notifications by type
  getNotificationsByType(type: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/notifications/type/${type}`,
      { headers: this.getHeaders() }
    );
  }

  // Get unread notifications
  getUnreadNotifications(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/notifications/unread`,
      { headers: this.getHeaders() }
    );
  }

  // Get real-time notifications (Observable stream)
  getRealTimeNotifications(): Observable<any> {
    return this.notificationSubject.asObservable();
  }

  // Mark notification as read
  markNotificationAsRead(notificationId: string): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/notifications/${notificationId}/read`,
      {},
      { headers: this.getHeaders() }
    );
  }

  // Mark all notifications as read
  markAllNotificationsAsRead(): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/notifications/mark-all-read`,
      {},
      { headers: this.getHeaders() }
    );
  }

  // Delete a notification
  deleteNotification(notificationId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/notifications/${notificationId}`,
      { headers: this.getHeaders() }
    );
  }

  // Delete all notifications
  deleteAllNotifications(): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/notifications/delete-all`,
      { headers: this.getHeaders() }
    );
  }

  // Get notification preferences
  getNotificationPreferences(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/notifications/preferences`,
      { headers: this.getHeaders() }
    );
  }

  // Update notification preferences
  updateNotificationPreferences(preferences: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/notifications/preferences`,
      preferences,
      { headers: this.getHeaders() }
    );
  }

  // Send a test notification
  sendTestNotification(): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/notifications/test`,
      {},
      { headers: this.getHeaders() }
    );
  }
}
