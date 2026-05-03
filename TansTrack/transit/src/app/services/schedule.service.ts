import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, BehaviorSubject } from 'rxjs';
import { map, catchError, tap } from 'rxjs/operators';

export interface Schedule {
  id: number;
  date: string;
  start_time: string;
  end_time: string;
  status: string;
  fare_regular: number;
  fare_aircon: number;
  notes?: string;
  accepted_at?: string;
  started_at?: string;
  completed_at?: string;
  route: {
    id: number;
    name: string;
    start_location: string;
    end_location: string;
    distance_km?: number;
    estimated_duration?: number;
    regular_price?: number;
    aircon_price?: number;
    description?: string;
  };
  bus: {
    id: number;
    bus_number: string;
    plate_number: string;
    model: string;
    capacity: number;
    accommodation_type: string;
    is_aircon: boolean;
    status: string;
  };
}

export interface SchedulesResponse {
  success: boolean;
  driver: {
    id: number;
    name: string;
    email: string;
  };
  summary: {
    total_upcoming: number;
    today_schedules: number;
    future_schedules: number;
    accepted_today?: number;
    active_today?: number;
    completed_today?: number;
  };
  schedules: {
    today: Schedule[];
    upcoming: Schedule[];
    all: Schedule[];
  };
}

@Injectable({
  providedIn: 'root'
})
export class ScheduleService {
  private baseUrl = '/api/v1';
  private schedulesSubject = new BehaviorSubject<SchedulesResponse | null>(null);
  public schedules$ = this.schedulesSubject.asObservable();
  
  // Current and next schedule for home page and tabs
  private currentScheduleSubject = new BehaviorSubject<Schedule | null>(null);
  public currentSchedule$ = this.currentScheduleSubject.asObservable();
  
  private nextScheduleSubject = new BehaviorSubject<Schedule | null>(null);
  public nextSchedule$ = this.nextScheduleSubject.asObservable();

  constructor(private http: HttpClient) {}

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    });
  }

  /**
   * Get driver schedules with proper categorization
   */
  getDriverSchedules(driverId: number): Observable<SchedulesResponse> {
    console.log('Fetching schedules for driver:', driverId);
    
    return this.http.get<SchedulesResponse>(`${this.baseUrl}/schedules/driver/${driverId}`, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => {
        console.log('Schedules received:', response);
        if (response.success) {
          // Update the schedules subject
          this.schedulesSubject.next(response);
          
          // Update current and next schedules for home/tabs
          this.updateCurrentAndNextSchedules(response.schedules.all);
        }
      }),
      catchError(error => {
        console.error('Error fetching schedules:', error);
        throw error;
      })
    );
  }

  /**
   * Update current and next schedules based on all schedules
   */
  private updateCurrentAndNextSchedules(allSchedules: Schedule[]) {
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    const currentTime = now.getHours() * 60 + now.getMinutes(); // Current time in minutes
    
    // Find current active schedule
    const activeSchedule = allSchedules.find(schedule => 
      schedule.status === 'active' && schedule.date === today
    );
    
    if (activeSchedule) {
      this.currentScheduleSubject.next(activeSchedule);
    } else {
      // Find next accepted schedule for today that hasn't started
      const todayAcceptedSchedules = allSchedules
        .filter(schedule => 
          schedule.status === 'accepted' && 
          schedule.date === today
        )
        .sort((a, b) => {
          const timeA = this.timeToMinutes(a.start_time);
          const timeB = this.timeToMinutes(b.start_time);
          return timeA - timeB;
        });
      
      const nextTodaySchedule = todayAcceptedSchedules.find(schedule => {
        const scheduleTime = this.timeToMinutes(schedule.start_time);
        return scheduleTime > currentTime;
      });
      
      this.currentScheduleSubject.next(nextTodaySchedule || null);
    }
    
    // Find next upcoming schedule (could be today or future)
    const upcomingSchedules = allSchedules
      .filter(schedule => {
        if (schedule.status !== 'accepted' && schedule.status !== 'scheduled') {
          return false;
        }
        
        if (schedule.date > today) {
          return true;
        }
        
        if (schedule.date === today) {
          const scheduleTime = this.timeToMinutes(schedule.start_time);
          return scheduleTime > currentTime && schedule.status === 'accepted';
        }
        
        return false;
      })
      .sort((a, b) => {
        if (a.date !== b.date) {
          return a.date.localeCompare(b.date);
        }
        const timeA = this.timeToMinutes(a.start_time);
        const timeB = this.timeToMinutes(b.start_time);
        return timeA - timeB;
      });
    
    // Set next schedule (skip current active one)
    const nextSchedule = upcomingSchedules.find(schedule => 
      schedule.id !== this.currentScheduleSubject.value?.id
    );
    
    this.nextScheduleSubject.next(nextSchedule || null);
    
    console.log('Updated current schedule:', this.currentScheduleSubject.value);
    console.log('Updated next schedule:', this.nextScheduleSubject.value);
  }

  private timeToMinutes(timeString: string): number {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
  }

  /**
   * Accept a schedule with immediate state update
   */
  acceptSchedule(scheduleId: number): Observable<any> {
    console.log('Accepting schedule:', scheduleId);
    
    return this.http.put<any>(`${this.baseUrl}/schedules/${scheduleId}/accept`, {}, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => {
        console.log('Schedule accepted:', response);
        if (response.success) {
          // Update local state immediately
          this.updateScheduleStatusLocally(scheduleId, 'accepted');
          
          // Refresh schedules to get updated categorization
          setTimeout(() => {
            this.refreshCurrentDriverSchedules();
          }, 100);
        }
      }),
      catchError(error => {
        console.error('Error accepting schedule:', error);
        throw error;
      })
    );
  }

  /**
   * Decline a schedule
   */
  declineSchedule(scheduleId: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/schedules/${scheduleId}/decline`, {}, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          this.updateScheduleStatusLocally(scheduleId, 'declined');
          setTimeout(() => {
            this.refreshCurrentDriverSchedules();
          }, 100);
        }
      })
    );
  }

  /**
   * Start a schedule
   */
  startSchedule(scheduleId: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/schedules/${scheduleId}/start`, {}, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          this.updateScheduleStatusLocally(scheduleId, 'active');
          setTimeout(() => {
            this.refreshCurrentDriverSchedules();
          }, 100);
        }
      })
    );
  }

  /**
   * Complete a schedule
   */
  completeSchedule(scheduleId: number): Observable<any> {
    return this.http.put<any>(`${this.baseUrl}/schedules/${scheduleId}/complete`, {}, {
      headers: this.getHeaders()
    }).pipe(
      tap(response => {
        if (response.success) {
          this.updateScheduleStatusLocally(scheduleId, 'completed');
          setTimeout(() => {
            this.refreshCurrentDriverSchedules();
          }, 100);
        }
      })
    );
  }

  /**
   * Update schedule status locally for immediate UI feedback
   */
  private updateScheduleStatusLocally(scheduleId: number, newStatus: string) {
    const currentData = this.schedulesSubject.value;
    if (!currentData) return;

    // Update in all schedule arrays
    const updateInArray = (schedules: Schedule[]) => {
      const schedule = schedules.find(s => s.id === scheduleId);
      if (schedule) {
        schedule.status = newStatus;
        if (newStatus === 'accepted') schedule.accepted_at = new Date().toISOString();
        if (newStatus === 'active') schedule.started_at = new Date().toISOString();
        if (newStatus === 'completed') schedule.completed_at = new Date().toISOString();
      }
    };

    updateInArray(currentData.schedules.all);
    updateInArray(currentData.schedules.today);
    updateInArray(currentData.schedules.upcoming);

    // Re-categorize schedules if needed (accepted schedule should move to today if it's for today)
    if (newStatus === 'accepted') {
      this.recategorizeSchedules(currentData);
    }

    // Update the subject with modified data
    this.schedulesSubject.next({ ...currentData });
    
    // Update current/next schedules
    this.updateCurrentAndNextSchedules(currentData.schedules.all);
  }

  /**
   * Re-categorize schedules when status changes
   */
  private recategorizeSchedules(data: SchedulesResponse) {
    const today = new Date().toISOString().split('T')[0];
    
    // Recategorize all schedules
    data.schedules.today = data.schedules.all.filter(schedule => schedule.date === today);
    data.schedules.upcoming = data.schedules.all.filter(schedule => schedule.date > today);
    
    // Update summary
    data.summary.today_schedules = data.schedules.today.length;
    data.summary.future_schedules = data.schedules.upcoming.length;
    data.summary.accepted_today = data.schedules.today.filter(s => s.status === 'accepted').length;
    data.summary.active_today = data.schedules.today.filter(s => s.status === 'active').length;
    data.summary.completed_today = data.schedules.today.filter(s => s.status === 'completed').length;
  }

  /**
   * Refresh schedules for current driver
   */
  refreshCurrentDriverSchedules(): void {
    // This should be called by components that know the current driver ID
    // We'll add a method to get the driver ID from auth service if available
  }

  /**
   * Get current driver's schedules (to be called by components)
   */
  refreshSchedulesForDriver(driverId: number): void {
    this.getDriverSchedules(driverId).subscribe({
      next: (response) => {
        console.log('Schedules refreshed successfully for driver:', driverId);
      },
      error: (error) => {
        console.error('Error refreshing schedules:', error);
      }
    });
  }

  /**
   * Get current schedules data
   */
  getCurrentSchedules(): SchedulesResponse | null {
    return this.schedulesSubject.value;
  }

  /**
   * Get current active/next schedule
   */
  getCurrentSchedule(): Schedule | null {
    return this.currentScheduleSubject.value;
  }

  /**
   * Get next upcoming schedule
   */
  getNextSchedule(): Schedule | null {
    return this.nextScheduleSubject.value;
  }

  // Helper methods
  canAccept(schedule: Schedule): boolean {
    return schedule.status === 'scheduled';
  }

  canDecline(schedule: Schedule): boolean {
    return schedule.status === 'scheduled' || schedule.status === 'accepted';
  }

  canStart(schedule: Schedule): boolean {
    const today = new Date().toISOString().split('T')[0];
    return schedule.status === 'accepted' && schedule.date === today;
  }

  canComplete(schedule: Schedule): boolean {
    return schedule.status === 'active';
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'scheduled': return 'primary';
      case 'accepted': return 'success';
      case 'active': return 'warning';
      case 'completed': return 'dark';
      case 'declined': return 'danger';
      case 'cancelled': return 'medium';
      default: return 'medium';
    }
  }

  formatTime(time: string): string {
    if (!time) return '';
    try {
      const [hours, minutes] = time.split(':');
      const hour24 = parseInt(hours);
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const ampm = hour24 >= 12 ? 'PM' : 'AM';
      return `${hour12}:${minutes} ${ampm}`;
    } catch (error) {
      return time;
    }
  }

  formatDate(date: string): string {
    if (!date) return '';
    try {
      const dateObj = new Date(date);
      return dateObj.toLocaleDateString('en-US', {
        weekday: 'short',
        month: 'short',
        day: 'numeric'
      });
    } catch (error) {
      return date;
    }
  }

  getRouteDetails(schedule: Schedule): string {
    if (!schedule.route) return 'Route details not available';
    return `${schedule.route.start_location} → ${schedule.route.end_location}`;
  }

  getBusDetails(schedule: Schedule): string {
    if (!schedule.bus) return 'Bus details not available';
    const bus = schedule.bus;
    const airconText = bus.is_aircon ? 'Air-Con' : 'Regular';
    return `${bus.bus_number} (${bus.model}) - ${airconText}`;
  }
}