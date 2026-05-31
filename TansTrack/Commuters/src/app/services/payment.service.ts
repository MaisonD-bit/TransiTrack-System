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

  /**
   * Create a real Maya Checkout session.
   * Returns the checkout URL to open in a popup.
   */
  async createMayaCheckout(payload: {
    public_ticket_id?: string;
    amount: number;
    route_name?: string;
    commuter_name?: string;
    /** Capacitor / mobile: app URL to return after PayMaya (e.g. https://localhost/#/tabs/home) */
    return_url?: string;
  }): Promise<{ success: boolean; checkout_url?: string; message?: string }> {
    try {
      console.log('[PaymentService] Creating Maya checkout with payload:', payload);
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/payments/maya/checkout`, payload)
      );
      console.log('[PaymentService] Maya checkout response:', res);
      if (!res?.success || !res?.checkout_url) {
        return {
          success: false,
          message: res?.message ?? 'Could not start Maya payment.',
        };
      }
      return { success: true, checkout_url: res.checkout_url };
    } catch (err: any) {
      const msg = err?.error?.message ?? 'Could not start Maya payment.';
      console.error('[PaymentService] Maya checkout error:', err, 'Message:', msg);
      return { success: false, message: msg };
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
