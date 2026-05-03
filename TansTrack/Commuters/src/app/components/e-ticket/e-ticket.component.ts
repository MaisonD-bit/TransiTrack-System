import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';

@Component({
  selector: 'app-e-ticket',
  templateUrl: './e-ticket.component.html',
  styleUrls: ['./e-ticket.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ETicketComponent {
  @Input() selectedRoute: any;
  @Input() ticketID: string = '';
  @Input() ticketFare: number | null = 0;
  @Input() currentTime: string = '';
  @Input() paymentMethod: string = 'cash';
  @Input() visible: boolean = false;

  @Output() close = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();

  readonly qrImage = 'assets/qrcode.png';

  getOrigin(): string {
    const name = this.selectedRoute?.name || '';
    return name ? name.split(' to ')[0] || 'Start Point' : 'Start Point';
  }

  getDestination(): string {
    const name = this.selectedRoute?.name || '';
    return name ? name.split(' to ')[1] || 'End Point' : 'End Point';
  }

  getRouteDistance(): string {
    const distance = this.selectedRoute?.distance_km;
    if (distance != null && distance !== '') {
      const numDistance = Number(distance);
      if (!isNaN(numDistance) && numDistance > 0) {
        return `${numDistance.toFixed(1)} km`;
      }
    }
    return 'N/A';
  }

  closeTicket() { this.close.emit(); }
  shareTicket() { this.share.emit(); }
}
