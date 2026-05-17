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
  }): Promise<{ success: boolean; checkout_url?: string; checkout_id?: string; reference_number?: string; message?: string }> {
    try {
      console.log('[PaymentService] Creating Maya checkout with payload:', payload);
      const res: any = await firstValueFrom(
        this.http.post(`${environment.apiUrl}/payments/maya/checkout`, payload)
      );
      console.log('[PaymentService] Maya checkout response:', res);
      return {
        success: true,
        checkout_url: res.checkout_url,
        checkout_id: res.checkout_id,
        reference_number: res.reference_number,
      };
    } catch (err: any) {
      const msg = err?.error?.message ?? 'Could not start Maya payment.';
      console.error('[PaymentService] Maya checkout error:', err, 'Message:', msg);
      return { success: false, message: msg };
    }
  }

  /**
   * Ask the backend (which queries Maya directly) whether a checkout has actually
   * been paid. Used as a last-chance reconciliation when the redirect-based callback
   * never reached our server (wrong APP_URL, the user closed the popup mid-redirect,
   * etc.). If Maya reports paid, the backend updates the ticket so the next
   * getActiveTicket() poll will also see the paid state.
   */
  async getMayaCheckoutStatus(checkoutId: string): Promise<{ success: boolean; paid: boolean; payment_status?: string; ticket_id?: string }> {
    try {
      const res: any = await firstValueFrom(
        this.http.get(`${environment.apiUrl}/payments/maya/checkout/${encodeURIComponent(checkoutId)}/status`)
      );
      return { success: !!res?.success, paid: !!res?.paid, payment_status: res?.payment_status, ticket_id: res?.ticket_id };
    } catch (err) {
      console.warn('[PaymentService] Maya checkout status query failed', err);
      return { success: false, paid: false };
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
