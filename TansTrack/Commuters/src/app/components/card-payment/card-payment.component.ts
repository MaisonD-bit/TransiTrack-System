import { Component, Input, Output, EventEmitter } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { PaymentService, CardDetails, PaymentResult } from '../../services/payment.service';

@Component({
  selector: 'app-card-payment',
  standalone: true,
  imports: [CommonModule, FormsModule, IonicModule],
  templateUrl: './card-payment.component.html',
  styleUrls: ['./card-payment.component.scss'],
})
export class CardPaymentComponent {
  @Input() fare: number = 0;
  @Input() routeName: string = '';
  @Output() paid = new EventEmitter<PaymentResult>();
  @Output() cancel = new EventEmitter<void>();

  cardNumber = '';
  expiry = '';
  cvc = '';
  cardName = '';
  isProcessing = false;
  error = '';

  constructor(private paymentService: PaymentService) {}

  get fareDisplay(): string {
    return `₱${(+this.fare).toFixed(2)}`;
  }

  onCardNumberInput(event: Event) {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '').substring(0, 16);
    this.cardNumber = raw.replace(/(.{4})/g, '$1 ').trim();
  }

  onExpiryInput(event: Event) {
    const raw = (event.target as HTMLInputElement).value.replace(/\D/g, '').substring(0, 4);
    this.expiry = raw.length >= 3 ? raw.substring(0, 2) + '/' + raw.substring(2) : raw;
  }

  async pay() {
    this.error = '';

    const raw = this.cardNumber.replace(/\s/g, '');
    const parts = this.expiry.split('/');
    const expMonth = parseInt(parts[0] ?? '', 10);
    const expYear = parseInt('20' + (parts[1] ?? ''), 10);

    if (raw.length < 13) { this.error = 'Enter a valid card number.'; return; }
    if (!expMonth || expMonth < 1 || expMonth > 12 || !expYear) { this.error = 'Enter a valid expiry (MM/YY).'; return; }
    if (this.cvc.length < 3) { this.error = 'Enter a valid CVC (3–4 digits).'; return; }
    if (!this.cardName.trim()) { this.error = 'Enter the cardholder name.'; return; }

    this.isProcessing = true;

    const card: CardDetails = {
      cardNumber: raw,
      expMonth,
      expYear,
      cvc: this.cvc,
      name: this.cardName.trim(),
    };

    const result = await this.paymentService.processCardPayment(
      this.fare, card, `Bus Fare — ${this.routeName}`
    );

    this.isProcessing = false;

    if (result.success) {
      this.paid.emit(result);
      return;
    }

    if (result.status === 'awaiting_3ds' && result.nextActionUrl) {
      window.open(result.nextActionUrl, '_blank');
      this.error = 'A 3D Secure window has opened. Complete verification there, then try again.';
      return;
    }

    this.error = result.error ?? 'Payment not completed. Please try again.';
  }
}
