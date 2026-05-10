import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

export interface CardDetails {
  cardNumber: string;
  expMonth: number;
  expYear: number;
  cvc: string;
  name: string;
}

export interface PaymentResult {
  success: boolean;
  paymentIntentId?: string;
  status?: string;
  nextActionUrl?: string;
  error?: string;
}

@Injectable({ providedIn: 'root' })
export class PaymentService {
  private backendUrl = `${environment.apiUrl}/payments/stripe`;

  constructor(private http: HttpClient) {}

  async getEWalletBalance(accountNumber: string): Promise<number> {
    const res: any = await firstValueFrom(
      this.http.get(`${environment.apiUrl}/payments/ewallet/balance/${encodeURIComponent(accountNumber)}`)
    );
    return res.balance;
  }

  async processEWalletPayment(fare: number, accountNumber: string, method: string): Promise<PaymentResult> {
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/payments/ewallet/charge`, { fare, accountNumber, method })
      );
      return { success: true, paymentIntentId: res.transactionId, status: 'succeeded' };
    } catch (err: any) {
      const detail = err?.error?.error ?? 'Payment failed.';
      return { success: false, error: detail };
    }
  }

  async topUpEWallet(accountNumber: string, amount = 1000): Promise<number> {
    const res: any = await firstValueFrom(
      this.http.post(`${environment.apiUrl}/payments/ewallet/topup`, { accountNumber, amount })
    );
    return res.balance;
  }

  async processCardPayment(fare: number, card: CardDetails, description?: string): Promise<PaymentResult> {
    try {
      const res: any = await firstValueFrom(
        this.http.post(`${this.backendUrl}/charge`, {
          fare,
          cardNumber: card.cardNumber.replace(/\s/g, ''),
          expMonth:   card.expMonth,
          expYear:    card.expYear,
          cvc:        card.cvc,
          cardName:   card.name,
          description: description ?? 'Bus Fare Payment',
        })
      );

      if (res.success) {
        return { success: true, paymentIntentId: res.paymentIntentId, status: 'succeeded' };
      }

      if (res.status === 'requires_3ds') {
        return { success: false, status: 'awaiting_3ds', nextActionUrl: res.nextActionUrl };
      }

      return { success: false, error: res.error ?? 'Payment was not completed.' };

    } catch (err: any) {
      const detail = err?.error?.error ?? err?.message ?? 'Payment failed. Please check your card details.';
      return { success: false, error: detail };
    }
  }
}
