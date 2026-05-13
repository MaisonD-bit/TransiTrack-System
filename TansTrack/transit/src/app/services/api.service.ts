import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpErrorResponse } from '@angular/common/http';
import { Observable, BehaviorSubject, throwError } from 'rxjs';
import { catchError, tap } from 'rxjs/operators';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private apiUrl: string;

  /** Shared unread count — tabs badge and notifications page both read/write this. */
  readonly driverUnreadCount$ = new BehaviorSubject<number>(0);

  constructor(private http: HttpClient) {
    this.apiUrl = environment.apiUrl; 
    console.log('ApiService initialized with apiUrl:', this.apiUrl);
  }

  // Simple headers - no CORS headers (browser handles this)
  private getHeaders(): HttpHeaders {
    let headersConfig: { [name: string]: string | string[] } = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };

    if (this.apiUrl.includes('ngrok-free.app')) {
      console.log('ApiService: Detected ngrok URL, adding skip warning header');
      headersConfig['ngrok-skip-browser-warning'] = 'true';
    }

    console.log('ApiService: Headers config:', headersConfig);
    return new HttpHeaders(headersConfig);
  }

  // Error handling
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    console.error('API Error:', error);
    console.error('Error status:', error.status);
    console.error('Error message:', error.message);
    console.error('Error body:', error.error);
    
    let errorMessage = 'Unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = `Server Error: ${error.status} - ${error.message}`;
      if (error.error && error.error.message) {
        errorMessage += ` - ${error.error.message}`;
      }
    }
    
    return throwError(() => new Error(errorMessage));
  };

  // Debug method for API calls
  debugApiCall(driverId: number | null): void {
    console.log('=== API DEBUG INFO ===');
    console.log('Base URL:', this.apiUrl);
    console.log('Driver ID:', driverId);
    console.log('Full URL would be:', `${this.apiUrl}/drivers/${driverId}/schedules`);
    console.log('Headers:', this.getHeaders());
  }

  // Test connection to your Laravel API
  testConnection(): Observable<any> {
    console.log('API: Testing connection to Laravel backend');
    // Test with a simple route that should exist
    return this.http.get(`${this.apiUrl}/drivers/1`, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Connection test successful:', response)),
      catchError(this.handleError)
    );
  }

  getDriverSchedules(driverId: number): Observable<any> {
    // Define the relative endpoint path correctly.
    // Based on your Laravel routes/api.php, it should be 'drivers/{id}/schedules'.
    const endpoint = `drivers/${driverId}/schedules`;
    const url = `${this.apiUrl}/${endpoint}`;
    console.log(`API: Fetching schedules for driver ${driverId} from ${url}`);
    return this.http.get(url, { headers: this.getHeaders() })
      .pipe(
        tap(response => console.log(`Schedules API Response for driver ${driverId}:`, response)),
        catchError(error => {
          console.error(`Error fetching schedules for driver ${driverId}:`, error);
          console.error(`Request URL was: ${url}`);
          return this.handleError(error);
        })
      );
  }

  declineSchedule(scheduleId: number, reason: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/decline`, { reason }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  startSchedule(scheduleId: number): Observable<any> {
    console.log(`API: Starting schedule ${scheduleId}`);
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/start`, {}, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Start schedule response:', response)),
      catchError(this.handleError)
    );
  }

  completeSchedule(scheduleId: number): Observable<any> {
    console.log(`API: Completing schedule ${scheduleId}`);
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/complete`, {}, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Complete schedule response:', response)),
      catchError(this.handleError)
    );
  }

  cancelSchedule(scheduleId: number, reason: string): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/cancel`, { reason }, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  // Driver profile methods (these call your existing DriverController methods)
  getDriverProfile(driverId: number): Observable<any> {
    console.log(`API: Getting driver profile ${driverId}`);
    return this.http.get(`${this.apiUrl}/drivers/${driverId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Driver profile response:', response)),
      catchError(this.handleError)
    );
  }

  updateDriverProfile(driverId: number, profileData: any): Observable<any> {
    console.log(`API: Updating driver profile ${driverId}`);
    return this.http.put(`${this.apiUrl}/drivers/${driverId}`, profileData, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Update profile response:', response)),
      catchError(this.handleError)
    );
  }

  // Route information methods
  getRoute(routeId: number): Observable<any> {
    console.log(`API: Getting route ${routeId}`);
    return this.http.get(`${this.apiUrl}/routes/${routeId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Route response:', response)),
      catchError(this.handleError)
    );
  }

  acceptSchedule(scheduleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/accept`, {}, {
      headers: this.getHeaders()
    });
  }

  post(endpoint: string, body: any): Observable<any> {
    const url = `${this.apiUrl}/${endpoint}`;
    console.log(`API: POST to ${url}`);
    return this.http.post(url, body, { headers: this.getHeaders() })
      .pipe(
        tap(response => console.log(`POST ${endpoint} Response:`, response)),
        catchError(this.handleError)
      );
  }

  put(endpoint: string, body: any): Observable<any> {
    const url = `${this.apiUrl}/${endpoint}`;
    console.log(`API: PUT to ${url}`);
    return this.http.put(url, body, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log(`PUT ${endpoint} response:`, response)),
      catchError(this.handleError)
    );
  }

  get(endpoint: string): Observable<any> {
    const url = `${this.apiUrl}/${endpoint}`;
    console.log(`API: GET from ${url}`);
    return this.http.get(url, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log(`GET ${endpoint} response:`, response)),
      catchError(this.handleError)
    );
  }

  // Get all schedules (admin view)
  getAllSchedules(): Observable<any> {
    console.log('API: Getting all schedules');
    return this.http.get(`${this.apiUrl}/schedules`, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('All schedules response:', response)),
      catchError(this.handleError)
    );
  }

  // Create new schedule (for admin use)
  createSchedule(scheduleData: any): Observable<any> {
    console.log('API: Creating new schedule', scheduleData);
    return this.http.post(`${this.apiUrl}/schedules`, scheduleData, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Create schedule response:', response)),
      catchError(this.handleError)
    );
  }

  // Driver registration (if needed)
  registerDriver(formData: any): Observable<any> {
    console.log('API: Registering new driver');
    return this.http.post(`${this.apiUrl}/drivers/register`, formData, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Register driver response:', response)),
      catchError(this.handleError)
    );
  }

  // loginDriver(credentials: any): Observable<any> {
  //   return this.http.post(`${this.apiUrl}/v1/drivers/login`, credentials, {
  //     headers: this.getHeaders()
  //   });
  // }

  loginDriver(credentials: { email: string, password: string }): Observable<any> { 
    const endpoint = 'drivers/login';
    const url = `${this.apiUrl}/${endpoint}`;
    console.log(`API: Attempting driver login at ${url}`);
    return this.http.post(url, credentials, { headers: this.getHeaders() })
      .pipe(
        tap(response => console.log('Login API Response:', response)),
        catchError(this.handleError)
      );
  }

  reportIssue(driverId: number, issueType: string, message: string): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/driver-send`, {
        driver_id: driverId,
        type: 'issue_report',
        message: message || `Driver reported a ${issueType} issue.`,
        issue_type: issueType
    }, { headers: this.getHeaders() });
  }

  sendEmergencyAlert(driverId: number, emergencyType: string, message: string): Observable<any> {
      return this.http.post(`${this.apiUrl}/notifications/driver-send`, {
          driver_id: driverId,
          type: 'emergency',
          message: message || `Driver triggered an emergency alert: ${emergencyType}`,
          emergency_type: emergencyType
      }, { headers: this.getHeaders() });
  }

  /**
   * Driver incident report with GPS + optional place name (operator sees in Notifications + Trip Logs map).
   */
  reportIncident(payload: {
    driver_id: number;
    incident_type: string;
    latitude: number;
    longitude: number;
    location_label?: string;
    schedule_id?: number;
    notes?: string;
  }): Observable<any> {
    return this.http.post(`${this.apiUrl}/notifications/incident`, payload, {
      headers: this.getHeaders(),
    });
  }

  getDriverNotifications(driverId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/notifications/driver/${driverId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => console.log('Driver notifications response:', response)),
      catchError(this.handleError)
    );
  }

  markNotificationAsRead(notificationId: number, driverId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/notifications/${notificationId}/read`, {
      driver_id: driverId
    }, { headers: this.getHeaders() });
  }

  markAllDriverNotificationsAsRead(driverId: number): Observable<any> {
    return this.http.patch(`${this.apiUrl}/notifications/driver/${driverId}/mark-all-read`, {}, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  clearDriverNotifications(driverId: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/notifications/driver/${driverId}/clear`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  deleteDriverNotification(id: number): Observable<any> {
    return this.http.delete(`${this.apiUrl}/notifications/${id}`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getTerminalParkingStatus(driverId: number): Observable<any> {
    const url = `${this.apiUrl}/terminal/driver-space-status?driver_id=${encodeURIComponent(String(driverId))}`;
    return this.http.get(url, { headers: this.getHeaders() }).pipe(
      tap(response => console.log('Terminal parking status:', response)),
      catchError(this.handleError)
    );
  }

  updateSchedulePosition(scheduleId: number, lat: number, lng: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/update-position`,
      { latitude: lat, longitude: lng },
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  requestTerminalParkingExtension(driverId: number, additionalMinutes: number): Observable<any> {
    return this.http.post(
      `${this.apiUrl}/terminal/request-space-extension`,
      { driver_id: driverId, additional_minutes: additionalMinutes },
      { headers: this.getHeaders() }
    ).pipe(
      tap(response => console.log('Terminal extension request:', response)),
      catchError(this.handleError)
    );
  }

  getDriverPerformance(driverId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/drivers/${driverId}/performance`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  getDriverStreamToken(driverId: number): Observable<any> {
    return this.http.get(`${this.apiUrl}/driver/stream-token?driver_id=${driverId}`, {
      headers: this.getHeaders()
    }).pipe(catchError(this.handleError));
  }

  getPassengerManifest(scheduleId: number): Observable<any> {
    return this.http.get(
      `${this.apiUrl}/schedules/${scheduleId}/manifest`,
      { headers: this.getHeaders() }
    ).pipe(catchError(this.handleError));
  }

  acceptReturnTrip(scheduleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/return/accept`, {}, { headers: this.getHeaders() }).pipe(catchError(this.handleError));
  }

  declineReturnTrip(scheduleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/return/decline`, {}, { headers: this.getHeaders() }).pipe(catchError(this.handleError));
  }

  startReturnTrip(scheduleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/return/start`, {}, { headers: this.getHeaders() }).pipe(catchError(this.handleError));
  }

  completeReturnTrip(scheduleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/return/complete`, {}, { headers: this.getHeaders() }).pipe(catchError(this.handleError));
  }

  endDay(scheduleId: number): Observable<any> {
    return this.http.put(`${this.apiUrl}/schedules/${scheduleId}/end-day`, {}, { headers: this.getHeaders() }).pipe(catchError(this.handleError));
  }
}