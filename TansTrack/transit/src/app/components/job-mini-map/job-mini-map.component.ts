import { Component, OnInit, Input, AfterViewInit } from '@angular/core';
import { Job } from '../../services/job.service';
import * as L from 'leaflet';

@Component({
  selector: 'app-job-mini-map',
  templateUrl: './job-mini-map.component.html',
  styleUrls: ['./job-mini-map.component.scss'],
  standalone: false
})
export class JobMiniMapComponent implements OnInit, AfterViewInit {
  @Input() job!: Job;
  @Input() mapId!: string;
  @Input() height: string = '150px';
  
  private map!: L.Map;
  private jobIcon!: L.Icon;
  error: string = '';

  constructor() { }

  ngOnInit() {
    // Initialize custom icon
    this.jobIcon = L.icon({
      iconUrl: 'assets/map/job-marker.svg',
      iconSize: [32, 42],
      iconAnchor: [16, 42],
      popupAnchor: [0, -42]
    });
    
    if (!this.job || !this.job.coordinates) {
      this.error = 'No location data available for this job';
    }
    
    if (!this.mapId) {
      this.mapId = `job-mini-map-${this.job?.id || Math.random().toString(36).substring(2, 9)}`;
    }
  }
  
  ngAfterViewInit() {
    if (this.job && this.job.coordinates) {
      this.initMap();
    }
  }
  
  private initMap(): void {
    setTimeout(() => {
      try {
        // Create map centered on job location
        this.map = L.map(this.mapId, {
          center: [this.job.coordinates!.lat, this.job.coordinates!.lng],
          zoom: 13,
          zoomControl: false,
          dragging: false,
          scrollWheelZoom: false,
          doubleClickZoom: false,
          attributionControl: false
        });

        // Add tile layer (base map)
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          maxZoom: 18,
          minZoom: 3
        }).addTo(this.map);

        // Add marker for job location with custom icon
        const marker = L.marker([this.job.coordinates!.lat, this.job.coordinates!.lng], { icon: this.jobIcon })
          .addTo(this.map)
          .bindPopup(`
            <strong>${this.job.title}</strong><br>
            <em>${this.job.company}</em>
          `);
      } catch (err) {
        console.error('Error initializing mini map:', err);
        this.error = 'Could not load map';
      }
    }, 50); // Small timeout to ensure DOM is ready
  }
}
