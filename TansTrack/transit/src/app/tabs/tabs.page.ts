import { Component, OnInit } from '@angular/core';
import { ApiService } from '../services/api.service';

interface Route {
  id: number;
  name: string;
  start_location: string;
  end_location: string;
  distance_km?: number;
  estimated_duration?: string;
  assigned_date: string;
  schedule_id: number;
}

@Component({
  selector: 'app-tabs',
  templateUrl: 'tabs.page.html',
  styleUrls: ['tabs.page.scss'],
  standalone: false
})
export class TabsPage implements OnInit {
  driverId: number | null = null;
  assignedRoutes: Route[] = [];
  unreadCount: number = 0;

  constructor(private apiService: ApiService) {}

  ngOnInit() {
    this.loadDriverInfo();
  }

  loadDriverInfo() {
    try {
      const driverId = localStorage.getItem('driverId');
      if (driverId) {
        this.driverId = parseInt(driverId);
        this.loadAssignedRoutes();
      }
    } catch (error) {
      console.error('Error loading driver info:', error);
    }
  }

  loadAssignedRoutes() {
    if (!this.driverId) return;

    this.apiService.getDriverSchedules(this.driverId).subscribe({
      next: (response) => {
        if (response.success && response.schedules) {
          this.assignedRoutes = this.extractUniqueRoutes(response.schedules);
        }
      },
      error: (error) => {
        console.error('Error loading assigned routes:', error);
      }
    });
  }

  private extractUniqueRoutes(schedules: any): any[] {
    // The schedules parameter IS the schedules object, not wrapped in another schedules property
    if (!schedules || !Array.isArray(schedules.all)) {
      console.warn('No schedules.all array found:', schedules);
      return [];
    }
    
    const routeMap = new Map();
    schedules.all.forEach((schedule: any) => {
      if (schedule.route) {
        routeMap.set(schedule.route.id, schedule.route);
      }
    });
    
    return Array.from(routeMap.values());
  }
}