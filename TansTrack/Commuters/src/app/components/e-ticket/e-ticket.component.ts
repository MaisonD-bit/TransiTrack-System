import { Component, Input, Output, EventEmitter, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import QRCode from 'qrcode';

@Component({
  selector: 'app-e-ticket',
  templateUrl: './e-ticket.component.html',
  styleUrls: ['./e-ticket.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule],
})
export class ETicketComponent implements OnChanges {
  @Input() selectedRoute: any;
  /** Route database id (string from API). */
  @Input() routeId: string | number | null | undefined;
  @Input() ticketID: string = '';
  @Input() ticketFare: number | null = 0;
  /** Boarding → alighting or route name. */
  @Input() tripLabel: string | null = null;
  @Input() currentTime: string = '';
  @Input() paymentMethod: string = 'cash';
  /** Signed server token to embed in QR (preferred). */
  @Input() qrToken: string | null = null;
  /** unpaid|pending|paid|failed */
  @Input() paymentStatus: string = 'unpaid';
  @Input() visible: boolean = false;
  @Input() discountPercent: number = 0;
  @Input() discountAmount: number = 0;
  @Input() passengerType: string = 'Regular';
  @Input() operatorCompany: string = '';
  @Input() busLabel: string = '';

  @Output() close = new EventEmitter<void>();
  @Output() share = new EventEmitter<void>();

  qrDataUrl: string | null = null;

  get isPaidOnline(): boolean {
    return this.paymentMethod !== 'cash';
  }

  get isQrAllowed(): boolean {
    return this.isPaidOnline && (this.paymentStatus || '').toLowerCase() === 'paid' && !!this.qrToken;
  }

  get routeDisplayName(): string {
    return this.selectedRoute?.name || '';
  }

  get fareNum(): number {
    const n = this.ticketFare ?? this.selectedRoute?.basefare;
    return typeof n === 'number' && !Number.isNaN(n) ? n : 0;
  }

  get concessionSummary(): string | null {
    const t = (this.passengerType || '').trim();
    if (!t || t.toLowerCase() === 'regular') {
      return this.discountPercent > 0 ? `${this.discountPercent}% concession` : null;
    }
    if (['Student', 'Senior', 'PWD'].includes(t) || this.discountPercent > 0) {
      return `${t}${this.discountPercent > 0 ? ` · ${this.discountPercent}% off` : ''}`;
    }
    return null;
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['visible'] && !this.visible) {
      this.qrDataUrl = null;
      return;
    }
    void this.regenerateQr();
  }

  private async regenerateQr(): Promise<void> {
    if (!this.visible || !this.selectedRoute || !this.ticketID || !this.isQrAllowed) {
      this.qrDataUrl = null;
      return;
    }

    const payload = { token: this.qrToken };

    try {
      this.qrDataUrl = await QRCode.toDataURL(JSON.stringify(payload), {
        width: 220,
        margin: 2,
        errorCorrectionLevel: 'M',
      });
    } catch {
      this.qrDataUrl = null;
    }
  }

  getPaymentLabel(): string {
    const labels: Record<string, string> = {
      cash: 'Cash',
      paymaya: 'PayMaya',
      gcash: 'GCash',
    };
    return labels[this.paymentMethod] || this.paymentMethod;
  }

  closeTicket() {
    this.close.emit();
  }
  shareTicket() {
    this.share.emit();
  }
}
