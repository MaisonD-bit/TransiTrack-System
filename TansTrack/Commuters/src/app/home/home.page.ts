import { Component, OnInit, OnDestroy } from '@angular/core';
import { ToastController, AlertController, LoadingController } from '@ionic/angular';
import { CommuterService, LiveRoute } from '../services/commuter.service';
import { BusSimulatorService } from '../services/bus-simulator.service';
import { TripHistoryService } from '../services/trip-history.service';
import { Subscription } from 'rxjs';
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
  standalone: false,
})
export class HomePage implements OnInit, OnDestroy {
  currentTime: string = '';

  // Real route data
  routes: LiveRoute[] = [];
  selectedRoute: LiveRoute | null = null;
  selectedRouteId: string = '';
  /** Terminal (north/south) — must match approved route packages */
  commuterTerminal: 'north' | 'south' = (environment as any).commuterTerminal || 'north';
  /** regular vs air-con — filters approved routes */
  busType: 'regular' | 'aircon' = (environment as any).commuterBusTypeDefault || 'regular';
  /** When terminal manager stops exist: user picks alighting point */
  stopChoice: string | number = 'terminus';
  private subscriptions: Subscription[] = [];
  // e-ticket state
  showTicket: boolean = false;
  ticketDestination: string | null = null;
  ticketFare: number | null = null;
  ticketId: string = '';
  paymentMethod: string = 'cash';
  discountPercent: number = 0;

  // Bus simulation for route visualization and distance tracking
  boardingLocation: { lng: number; lat: number } | null = null;
  currentBusPosition: { lng: number; lat: number } | null = null;
  distanceTraveled: number = 0; // Distance in kilometers from boarding point
  isSimulationActive: boolean = false;
  private busSimulationSubscription: Subscription | null = null;

  constructor(
    private toastController: ToastController,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private commuterService: CommuterService,
    private busSimulator: BusSimulatorService,
    private tripHistoryService: TripHistoryService
  ) {}

  ngOnInit() {
    this.updateCurrentTime();
    setInterval(() => {
      this.updateCurrentTime();
    }, 60000);
    
    this.loadRouteData();
  }

  get stopPinsForMap(): { lng: number; lat: number; label?: string }[] {
    const stops = this.selectedRoute?.stops;
    if (!stops?.length) return [];
    return stops.map((s: any, i: number) => ({
      lng: Number(s.lng),
      lat: Number(s.lat),
      label: s.name || `Stop ${i + 1}`,
    }));
  }

  onTerminalChange() {
    this.commuterService.setTerminal(this.commuterTerminal);
  }

  onBusTypeChange() {
    this.commuterService.setBusType(this.busType);
    this.selectedRouteId = '';
    this.selectedRoute = null;
    this.ticketFare = null;
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
    this.stopBusSimulation();
  }

  loadRouteData() {
    console.log('Home page: Loading route data...');
    // Subscribe to routes data
    const routesSub = this.commuterService.routes$.subscribe(routes => {
      console.log('Home page: Received routes:', routes);
      this.routes = routes;
    });
    
    this.subscriptions.push(routesSub);
  }
  async onRouteSelected() {
    if (!this.selectedRouteId) {
      this.selectedRoute = null;
      return;
    }

    // pick from cache
    this.selectedRoute = this.routes.find(route => route.id === this.selectedRouteId) || null;
    console.log('Selected route:', this.selectedRoute);

    if (!this.selectedRoute) return;

    // Parse geometry if it's a string
    if (this.selectedRoute.geometry && typeof this.selectedRoute.geometry === 'string') {
      try {
        this.selectedRoute.geometry = JSON.parse(this.selectedRoute.geometry);
      } catch (e) {
        console.error('Failed to parse route geometry:', e);
      }
    }

    this.stopChoice = 'terminus';

    try {
      this.ticketDestination = this.selectedRoute.name || null;

      // Terminal-defined stops → fare by distance to selected stop
      if (this.selectedRoute.stops && this.selectedRoute.stops.length > 0) {
        this.ticketFare = null;
        this.discountPercent = 0;
        this.applyFareForStopChoice();
        this.ticketId = this.generateTicketId();
        this.showTicket = false;
        if (this.selectedRoute.geometry?.coordinates) {
          this.startBusSimulation();
        }
        return;
      }

      const passengerType = this.commuterService.getPassengerType();
      this.commuterService.calculateFareWithDiscount(this.selectedRoute.id, passengerType).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.ticketFare = response.data.final_fare;
            this.discountPercent = response.data.discount_percent || 0;
            if (response.data.discount_amount > 0) {
              this.showToast(
                `${passengerType} Discount Applied: -₱${response.data.discount_amount} (${response.data.discount_percent}%)`,
                'success'
              );
            }
          }
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare || 0;
        },
      });

      this.ticketId = this.generateTicketId();
      this.showTicket = true;

      if (this.selectedRoute.geometry?.coordinates) {
        this.startBusSimulation();
      }
    } catch (e) {
      console.error('Failed to set ticket data on selection:', e);
    }
  }

  onStopChoiceChange() {
    this.applyFareForStopChoice();
  }

  /** Fare proportional to distance along route (backend fare-preview) */
  private applyFareForStopChoice() {
    if (!this.selectedRoute?.stops?.length) return;

    let idx = this.selectedRoute.stops.length - 1;
    if (this.stopChoice !== 'terminus' && this.stopChoice !== '') {
      const n = typeof this.stopChoice === 'string' ? parseInt(this.stopChoice, 10) : Number(this.stopChoice);
      if (!Number.isNaN(n)) idx = n;
    }

    this.commuterService
      .previewFareAtStop(this.selectedRoute!.id, idx, this.selectedRoute!.approval_request_id)
      .subscribe({
        next: (res) => {
          if (res.success && res.data?.fare != null) {
            this.ticketFare = res.data.fare;
            const stop = this.selectedRoute!.stops![idx];
            this.ticketDestination = `${this.selectedRoute!.name} → ${stop?.name || 'Stop ' + (idx + 1)}`;
          }
        },
        error: () => {
          this.ticketFare = this.selectedRoute?.basefare ?? 0;
        },
      });
  }

  onTrackRoute() {
    if (!this.selectedRoute) {
      this.showToast('Please select a route to track', 'warning');
      return;
    }
    console.log('Tracking route requested for:', this.selectedRoute);
    // For now we just notify the user; future improvement: navigate to a live-tracking view
    this.showToast(`Tracking ${this.selectedRoute.name}`, 'success');
  }

  // Quick pay flow for demo: pays with passenger type discount applied
  async payFare() {
    if (!this.selectedRoute) {
      this.showToast('Select a route first', 'warning');
      return;
    }
    
    // Calculate fare with passenger type discount from backend
    const passengerType = this.commuterService.getPassengerType();
    
    this.commuterService.calculateFareWithDiscount(
      this.selectedRoute.id,
      passengerType
    ).subscribe({
      next: (response) => {
        if (response.success && response.data) {
          // Demo mode: instead of opening an external payment flow, just show the e-ticket
          this.ticketDestination = this.selectedRoute?.name || null;
          this.ticketFare = response.data.final_fare;
            this.discountPercent = response.data.discount_percent || 0;
          this.ticketId = this.generateTicketId(); // Generate and store the ticket ID once
          this.showTicket = true;
          
          // Show appropriate message
          let message = `e-ticket for ${this.ticketDestination} (₱${response.data.final_fare.toFixed(2)})`;
          if (response.data.discount_amount > 0) {
            message += ` - ${passengerType} discount applied!`;
          }
          this.showToast(message, 'success');
        }
      },
      error: (error) => {
        console.error('Error calculating fare:', error);
        this.showToast('Error calculating fare', 'danger');
      }
    });
  }

  async showToast(message: string, color: string = 'primary') {
    const toast = await this.toastController.create({
      message: message,
      duration: 3000,
      color: color,
      position: 'top'
    });
    toast.present();
  }

  generateTicket() {
    if (this.selectedRoute) {
      this.ticketDestination = this.selectedRoute.name;
      
      // Calculate fare with passenger type discount from backend
      const passengerType = this.commuterService.getPassengerType();
      
      this.commuterService.calculateFareWithDiscount(
        this.selectedRoute.id,
        passengerType
      ).subscribe({
        next: (response) => {
          if (response.success && response.data) {
            this.ticketFare = response.data.final_fare;
            this.discountPercent = response.data.discount_percent || 0;
            this.ticketId = this.generateTicketId(); // Generate and store the ticket ID once
            console.log('Generated Ticket ID:', this.ticketId);
            console.log('Fare Calculation:', response.data);
            this.showTicket = true;
            
            // Start bus simulation for route tracking (distance display only)
            this.startBusSimulation();
            
            // Show appropriate message with discount info
            let message = `e-Ticket generated! Fare: ₱${response.data.final_fare.toFixed(2)}`;
            if (response.data.discount_amount > 0) {
              message += ` (${passengerType} discount: -₱${response.data.discount_amount})`;
            }
            this.showToast(message, 'success');
          }
        },
        error: (error) => {
          console.error('Error calculating fare:', error);
          // Fallback to base fare if API fails
          this.ticketFare = this.selectedRoute?.basefare || 0;
          this.ticketId = this.generateTicketId();
          this.showTicket = true;
          this.startBusSimulation();
          this.showToast('e-Ticket generated! Using base fare', 'warning');
        }
      });
    }
  }

  private generateTicketId(): string {
    // Generate a unique ticket ID based on timestamp and random number
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = Math.random().toString(36).substring(2, 6).toUpperCase();
    const id = `${timestamp}-${random}`;
    console.log('generateTicketId called, ID:', id);
    return id;
  }

  getPaymentMethodLabel(): string {
    const labels: { [key: string]: string } = {
      'cash': 'Cash',
      'paymaya': 'PayMaya',
      'gcash': 'GCash'
    };
    return labels[this.paymentMethod] || 'Cash';
  }

  getPaymentIcon(): string {
    const icons: { [key: string]: string } = {
      'cash': 'cash-outline',
      'paymaya': 'card-outline',
      'gcash': 'phone-portrait-outline'
    };
    return icons[this.paymentMethod] || 'cash-outline';
  }

  closeTicket() {
    if (this.selectedRoute && this.ticketId) {
      const distanceKm = this.selectedRoute.distance_km;
      const trip = {
        id: this.ticketId,
        routeName: this.selectedRoute.name || '',
        departure: this.getOrigin(),
        arrival: this.getDestinationPoint(),
        departureTime: this.currentTime,
        arrivalTime: this.currentTime,
        fare: this.ticketFare || this.selectedRoute.basefare || 0,
        paymentMethod: this.paymentMethod,
        status: 'completed',
        driverName: '',
        busPlateNumber: '',
        tripDate: new Date().toISOString(),
        distance: typeof distanceKm === 'string' ? parseFloat(distanceKm) : (distanceKm || 0),
        duration: ''
      };
      this.tripHistoryService.saveLocalTrip(trip);
    }
    this.showTicket = false;
    this.stopBusSimulation();
    this.showToast('Ticket closed. Trip saved to history.', 'medium');
  }

  async shareTicket() {
    // Check if Web Share API is available
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Transit e-Ticket',
          text: `My e-Ticket for ${this.ticketDestination} - Ticket ID: #${this.ticketId}`,
          url: window.location.href
        });
        this.showToast('Ticket shared successfully!', 'success');
      } catch (error) {
        console.log('Error sharing:', error);
      }
    } else {
      // Fallback: Copy to clipboard
      const ticketInfo = `Transit e-Ticket\nRoute: ${this.ticketDestination}\nTicket ID: #${this.ticketId}\nFare: ₱${this.ticketFare}\nPayment: ${this.getPaymentMethodLabel()}`;
      
      if (navigator.clipboard) {
        try {
          await navigator.clipboard.writeText(ticketInfo);
          this.showToast('Ticket details copied to clipboard!', 'success');
        } catch (error) {
          this.showToast('Unable to share ticket', 'warning');
        }
      } else {
        this.showToast('Sharing not supported on this device', 'warning');
      }
    }
  }

  async handleMakeStop() {
    if (!this.selectedRoute) return;

    const currentFare = this.ticketFare || this.selectedRoute.basefare;

    const alert = await this.alertController.create({
      header: 'Make Stop & Pay',
      message: `
        <div style="text-align: center; padding: 10px;">
          <p style="font-size: 16px; margin: 10px 0;">Ready to get off?</p>
          <p style="font-size: 14px; color: #666;">Distance traveled: ${this.getDistanceTraveled()}</p>
          <p style="font-size: 14px; color: #666;">Please pay ₱${currentFare.toFixed(2)} to the conductor</p>
        </div>
      `,
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Confirm Payment',
          handler: async () => {
            // Show loading
            const loading = await this.loadingController.create({
              message: 'Processing...',
              duration: 1000
            });
            await loading.present();

            setTimeout(async () => {
              await loading.dismiss();
              
              // Stop bus simulation
              this.stopBusSimulation();
              
              // Close ticket and show receipt
              this.showTicket = false;
              this.selectedRoute = null;
              
              const receiptAlert = await this.alertController.create({
                header: '✅ Payment Confirmed',
                message: `
                  <div style="text-align: center; padding: 10px;">
                    <p style="font-size: 16px; margin: 10px 0;">Thank you for riding with us!</p>
                    <p style="font-size: 14px; color: #666;">Distance: ${this.getDistanceTraveled()}</p>
                    <p style="font-size: 14px; color: #666;">Fare: ₱${currentFare.toFixed(2)}</p>
                    <p style="font-size: 14px; color: #666;">Receipt sent to your account</p>
                  </div>
                `,
                buttons: ['Done']
              });
              await receiptAlert.present();
              
              this.showToast('Trip completed successfully', 'success');
            }, 1000);
          }
        }
      ]
    });

    await alert.present();
  }

  updateCurrentTime() {
    const now = new Date();
    this.currentTime = now.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  /**
   * Get the calculated distance for a route
   * @param route The route object
   * @returns Formatted distance string (e.g., "12.5 km")
   */
  getRouteDistance(route: LiveRoute | null): string {
    if (!route) {
      return '—';
    }
    
    // Use the distance_km from backend
    if (route.distance_km && route.distance_km > 0) {
      const distance = typeof route.distance_km === 'string' ? parseFloat(route.distance_km) : route.distance_km;
      if (distance < 1) {
        return `${Math.round(distance * 1000)} m`;
      }
      return `${distance.toFixed(1)} km`;
    }
    
    return '—';
  }

  /**
   * Start bus simulation for route visualization and distance tracking
   * Note: Fare is fixed (basefare), simulation shows route progress and distance only
   */
  private startBusSimulation() {
    // Stop any existing simulation
    this.stopBusSimulation();

    if (!this.selectedRoute?.geometry?.coordinates) {
      console.warn('Cannot start simulation: No route geometry available');
      return;
    }

    const coords = this.selectedRoute.geometry.coordinates;
    if (!Array.isArray(coords) || coords.length < 2) {
      console.warn('Cannot start simulation: Invalid coordinates');
      return;
    }

    // Set boarding location as the first coordinate (route start)
    const firstCoord = coords[0];
    console.log('First coordinate from route:', firstCoord);
    
    this.boardingLocation = {
      lng: Number(firstCoord[0]),
      lat: Number(firstCoord[1])
    };
    
    console.log('Boarding location set to:', this.boardingLocation);
    
    // Validate boarding location
    if (isNaN(this.boardingLocation.lng) || isNaN(this.boardingLocation.lat)) {
      console.error('Invalid boarding location coordinates!');
      return;
    }
    
    this.currentBusPosition = { ...this.boardingLocation };
    this.distanceTraveled = 0;
    this.ticketFare = 0; 
    this.isSimulationActive = true;

    console.log('Starting bus simulation from:', this.boardingLocation);
    console.log('Route has', coords.length, 'coordinate points');
    console.log('First 3 coords:', coords.slice(0, 3));

    // Simulate bus movement at realistic speed (updates every 2 seconds)
    // Realistic bus speed: 50 km/h ≈ 28 meters per 2 seconds
    // Get total distance from Mapbox (already calculated and stored)
    const totalDistance = this.selectedRoute.distance_km || 0;
    const totalSteps = coords.length;
    
    console.log(`Route total distance from Mapbox: ${totalDistance} km, Total steps: ${totalSteps}`);

    this.busSimulationSubscription = this.busSimulator
      .simulateAlongLine(coords, 2000) // Update every 2 seconds
      .subscribe({
        next: (position) => {
          console.log('Received position from simulator:', position);
          
          // Validate position has valid lng/lat
          if (!position || position.lng === undefined || position.lat === undefined || 
              isNaN(position.lng) || isNaN(position.lat)) {
            console.error('Invalid position from simulator:', position);
            return;
          }
          
          this.currentBusPosition = {
            lng: Number(position.lng),
            lat: Number(position.lat)
          };

          // Calculate distance traveled based on progress along route
          // Use Mapbox distance and interpolate based on position index
          if (totalDistance > 0 && totalSteps > 0) {
            const progress = position.index / totalSteps; // 0 to 1
            this.distanceTraveled = totalDistance * progress;
            
            console.log(`Bus at step ${position.index}/${totalSteps}: Distance traveled = ${this.distanceTraveled.toFixed(2)} km (${(progress * 100).toFixed(1)}% of route)`);
          }
        },
        error: (err) => {
          console.error('Bus simulation error:', err);
          this.stopBusSimulation();
        }
      });
  }

  /**
   * Stop the bus simulation
   */
  private stopBusSimulation() {
    if (this.busSimulationSubscription) {
      this.busSimulationSubscription.unsubscribe();
      this.busSimulationSubscription = null;
    }
    this.isSimulationActive = false;
    console.log('Bus simulation stopped');
  }



  /**
   * Get formatted distance traveled string
   */
  getDistanceTraveled(): string {
    // Handle null, undefined, NaN, or 0
    if (!this.distanceTraveled || this.distanceTraveled === 0 || isNaN(this.distanceTraveled)) {
      return '0.0 km';
    }
    return `${this.distanceTraveled.toFixed(1)} km`;
  }

  /**
   * Get origin point from ticket destination
   */
  getOrigin(): string {
    return this.ticketDestination ? this.ticketDestination.split(' to ')[0] || 'Start Point' : 'Start Point';
  }

  /**
   * Get destination point from ticket destination
   */
  getDestinationPoint(): string {
    return this.ticketDestination ? this.ticketDestination.split(' to ')[1] || 'End Point' : 'End Point';
  }
}