import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class PaymentService {
  private apiUrl = `${environment.apiUrl}/payments`;

  constructor(private http: HttpClient) { }

  /**
   * Process payment via PayMaya
   * @param paymentRequest - Payment request object with amount, token, metadata
   * @returns Promise with payment result
   */
  async processPayMayaPayment(paymentRequest: any): Promise<any> {
    try {
      // Mock implementation for demo - replace with actual API call
      console.log('Processing PayMaya payment:', paymentRequest);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Mock successful response
      return {
        success: true,
        data: {
          id: 'pay_' + Date.now(),
          status: 'completed',
          amount: paymentRequest.amount,
          currency: paymentRequest.currency,
          transactionId: 'txn_' + Date.now()
        },
        message: 'Payment processed successfully'
      };
      
      // TODO: Replace with actual PayMaya API call
      // const response = await firstValueFrom(
      //   this.http.post(`${this.apiUrl}/paymaya`, paymentRequest)
      // );
      // return response;
      
    } catch (error) {
      console.error('PayMaya payment failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Payment processing failed'
      };
    }
  }

  /**
   * Create cash payment reservation
   * @param reservationData - Reservation data with amount, userId, routeId, etc.
   * @returns Promise with reservation result
   */
  async createCashReservation(reservationData: any): Promise<any> {
    try {
      // Mock implementation for demo - replace with actual API call
      console.log('Creating cash reservation:', reservationData);
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // Mock successful response
      const reservationCode = 'RES-' + Math.random().toString(36).substr(2, 8).toUpperCase();
      
      return {
        success: true,
        data: {
          id: 'res_' + Date.now(),
          reservationCode: reservationCode,
          status: 'reserved',
          amount: reservationData.finalAmount,
          expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() // 24 hours
        },
        message: 'Reservation created successfully'
      };
      
      // TODO: Replace with actual API call
      // const response = await firstValueFrom(
      //   this.http.post(`${this.apiUrl}/cash-reservation`, reservationData)
      // );
      // return response;
      
    } catch (error) {
      console.error('Cash reservation failed:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Reservation failed'
      };
    }
  }

  /**
   * Get payment status
   * @param paymentId - Payment ID to check status
   * @returns Promise with payment status
   */
  async getPaymentStatus(paymentId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.apiUrl}/${paymentId}`)
      );
      return response;
    } catch (error) {
      console.error('Failed to get payment status:', error);
      throw error;
    }
  }

  /**
   * List user payments
   * @param userId - User ID
   * @returns Promise with payments list
   */
  async getUserPayments(userId: string): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.apiUrl}/user/${userId}`)
      );
      return response;
    } catch (error) {
      console.error('Failed to get user payments:', error);
      throw error;
    }
  }

  /**
   * Apply discount code
   * @param discountCode - Discount code
   * @param amount - Base amount to apply discount to
   * @returns Promise with discounted amount
   */
  async applyDiscount(discountCode: string, amount: number): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.post(`${this.apiUrl}/apply-discount`, { discountCode, amount })
      );
      return response;
    } catch (error) {
      console.error('Failed to apply discount:', error);
      throw error;
    }
  }

  /**
   * Get available payment methods
   * @returns Promise with payment methods list
   */
  async getPaymentMethods(): Promise<any> {
    try {
      const response = await firstValueFrom(
        this.http.get(`${this.apiUrl}/methods`)
      );
      return response;
    } catch (error) {
      console.error('Failed to get payment methods:', error);
      throw error;
    }
  }
}