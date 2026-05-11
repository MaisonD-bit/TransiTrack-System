import { Component, Input, Output, EventEmitter, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import QRCode from 'qrcode';

@Component({
  selector: 'app-e-ticket',
  templateUrl: './e-ticket.component.html',
  styleUrls: ['./e-ticket.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class ETicketComponent implements OnChanges {
  @Input() selectedRoute: any;
  @Input() ticketID: string = '';
  @Input() ticketFare: number | null = 0;
  @Input() currentTime: string = '';
  @Input() paymentMethod: string = 'cash';
  @Input() visible: boolean = false;
  @Input() operatorCompany: string = '';
  @Input() busLabel: string = '';
  @Input() discountPercent: number = 0;
  @Input() passengerType: string = '';

  @Output() close = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();
  @Output() scanToPay = new EventEmitter<void>();

  qrDataUrl: string = '';

  get hasDiscount(): boolean {
    return this.discountPercent > 0 && this.passengerType !== 'Regular';
  }

  ngOnChanges(): void {
    if (this.visible && this.ticketID && this.selectedRoute) {
      const payload = [
        this.ticketID,
        this.selectedRoute.name,
        this.ticketFare ?? 0,
        this.currentTime
      ].join('|');
      QRCode.toDataURL(payload, { width: 200, margin: 1 })
        .then(url => this.qrDataUrl = url)
        .catch(() => this.qrDataUrl = '');
    }
  }

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
  openScanToPay() { this.scanToPay.emit(); }

  downloadQr() {
    if (!this.qrDataUrl) return;
    const a = document.createElement('a');
    a.href = this.qrDataUrl;
    a.download = `eticket-${this.ticketID}.png`;
    a.click();
  }
}
