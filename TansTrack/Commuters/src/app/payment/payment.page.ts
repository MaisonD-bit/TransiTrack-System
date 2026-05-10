import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router, ActivatedRoute } from '@angular/router';
import { AlertController, ToastController, LoadingController } from '@ionic/angular';
import { PaymentService } from '../services/payment.service';

interface PaymentData {
  origin: string;
  destination: string;
  passengerType: string;
  fare: number;
  discount: number;
  finalAmount: number;
  distance?: number;
  duration?: string;
}

interface PaymentMethod {
  id: string;
  name: string;
  description: string;
  icon: string;
  enabled: boolean;
}

@Component({
  selector: 'app-payment',
  templateUrl: './payment.page.html',
  styleUrls: ['./payment.page.scss'],
  standalone: false
})
export class PaymentPage implements OnInit {
  paymentData: PaymentData | null = null;
  paymentForm: FormGroup;
  selectedPaymentMethod: string = '';
  processing: boolean = false;
  
  // Mock wallet and statistics data
  walletBalance = 1250.00;
  monthlySpent = 420.50;
  totalTrips = 28;
  averageFare = 15.02;
  
  paymentMethods: PaymentMethod[] = [
    {
      id: 'paymaya',
      name: 'PayMaya',
      description: 'Pay with your PayMaya account or credit/debit card',
      icon: 'card-outline',
      enabled: true
    },
    {
      id: 'gcash',
      name: 'GCash',
      description: 'Pay using your GCash mobile wallet',
      icon: 'phone-portrait-outline',
      enabled: false // Will be enabled when integrated
    },
    {
      id: 'grabpay',
      name: 'GrabPay',
      description: 'Pay using your GrabPay wallet',
      icon: 'wallet-outline',
      enabled: false // Will be enabled when integrated
    },
    {
      id: 'bpi',
      name: 'BPI Online',
      description: 'Pay using your BPI online banking account',
      icon: 'card-outline',
      enabled: true
    },
    {
      id: 'bdo',
      name: 'BDO Online',
      description: 'Pay using your BDO online banking account',
      icon: 'card-outline',
      enabled: true
    },
    {
      id: 'credit-card',
      name: 'Credit/Debit Card',
      description: 'Pay with Visa, Mastercard, or other cards',
      icon: 'card-outline',
      enabled: true
    },
    {
      id: 'cash',
      name: 'Pay on Bus',
      description: 'Pay with cash when you board the bus',
      icon: 'cash-outline',
      enabled: true
    }
  ];

  // Mock transaction history
  transactionHistory = [
    {
      id: 'TXN001',
      date: '2025-09-28',
      time: '08:30 AM',
      route: 'Route 1: Downtown - University',
      amount: 15.00,
      status: 'completed',
      paymentMethod: 'PayMaya'
    },
    {
      id: 'TXN002', 
      date: '2025-09-27',
      time: '09:15 AM',
      route: 'Route 2: Mall - Airport',
      amount: 20.00,
      status: 'completed',
      paymentMethod: 'GCash'
    },
    {
      id: 'TXN003',
      date: '2025-09-26',
      time: '07:45 AM', 
      route: 'Route 3: Residential - City Center',
      amount: 12.00,
      status: 'refunded',
      paymentMethod: 'Credit Card'
    }
  ];

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private route: ActivatedRoute,
    private alertController: AlertController,
    private toastController: ToastController,
    private loadingController: LoadingController,
    private paymentService: PaymentService
  ) {
    this.paymentForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      phoneNumber: ['', [Validators.required, Validators.pattern(/^09\d{9}$/)]],
      terms: [false, Validators.requiredTrue]
    });

    // Set default payment data for display
    this.paymentData = {
      origin: 'Downtown Terminal',
      destination: 'University Main Gate',
      passengerType: 'Student',
      fare: 15.00,
      discount: 3.00,
      finalAmount: 12.00,
      distance: 8.5,
      duration: '25 minutes'
    };
  }

  ngOnInit() {
    // Get payment data from navigation state or query params
    this.loadPaymentData();
  }

  loadPaymentData() {
    // Get data from router state
    if (this.router.getCurrentNavigation()?.extras.state) {
      this.paymentData = this.router.getCurrentNavigation()?.extras.state?.['paymentData'];
    }
    
    // Fallback: get from query params
    if (!this.paymentData) {
      this.route.queryParams.subscribe(params => {
        if (params['fareData']) {
          try {
            this.paymentData = JSON.parse(params['fareData']);
          } catch (error) {
            console.error('Error parsing fare data:', error);
            this.showErrorAndGoBack('Invalid payment data');
          }
        } else {
          this.showErrorAndGoBack('No payment data available');
        }
      });
    }
  }

  selectPaymentMethod(methodId: string) {
    if (this.paymentMethods.find(m => m.id === methodId)?.enabled) {
      this.selectedPaymentMethod = methodId;
    }
  }

  async processPayment() {
    if (!this.paymentData) {
      this.showToast('Payment data not available', 'danger');
      return;
    }

    if (!this.selectedPaymentMethod) {
      this.showToast('Please select a payment method', 'warning');
      return;
    }

    if (this.selectedPaymentMethod === 'paymaya' && !this.paymentForm.valid) {
      this.markFormGroupTouched(this.paymentForm);
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    this.processing = true;
    const loading = await this.loadingController.create({
      message: 'Processing payment...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      if (this.selectedPaymentMethod === 'paymaya') {
        await this.processPayMayaPayment();
      } else if (this.selectedPaymentMethod === 'cash') {
        await this.processCashPayment();
      }
    } catch (error) {
      console.error('Payment processing error:', error);
      this.showToast('Payment failed. Please try again.', 'danger');
    } finally {
      this.processing = false;
      await loading.dismiss();
    }
  }

  async processPayMayaPayment() {
    const paymentRequest = {
      amount: this.paymentData!.finalAmount,
      currency: 'PHP',
      description: `Bus Ticket: ${this.paymentData!.origin} to ${this.paymentData!.destination}`,
      buyer: {
        email: this.paymentForm.get('email')?.value,
        phone: this.paymentForm.get('phoneNumber')?.value
      },
      metadata: {
        origin: this.paymentData!.origin,
        destination: this.paymentData!.destination,
        passengerType: this.paymentData!.passengerType,
        fare: this.paymentData!.fare,
        discount: this.paymentData!.discount || 0
      }
    };

    try {
      const paymentResult = await this.paymentService.processPayMayaPayment(paymentRequest);
      
      if (paymentResult.success) {
        await this.handlePaymentSuccess(paymentResult.data);
      } else {
        throw new Error(paymentResult.message || 'Payment failed');
      }
    } catch (error) {
      throw error;
    }
  }

  async processCashPayment() {
    // For cash payment, we just need to create a reservation
    const reservationData = {
      origin: this.paymentData!.origin,
      destination: this.paymentData!.destination,
      passengerType: this.paymentData!.passengerType,
      fare: this.paymentData!.fare,
      discount: this.paymentData!.discount || 0,
      finalAmount: this.paymentData!.finalAmount,
      paymentMethod: 'cash',
      status: 'reserved'
    };

    try {
      const reservationResult = await this.paymentService.createCashReservation(reservationData);
      
      if (reservationResult.success) {
        await this.handleReservationSuccess(reservationResult.data);
      } else {
        throw new Error(reservationResult.message || 'Reservation failed');
      }
    } catch (error) {
      throw error;
    }
  }

  async handlePaymentSuccess(paymentData: any) {
    await this.showSuccessAlert('Payment Successful!', 
      'Your payment has been processed successfully. Your e-ticket has been generated.');
    
    // Navigate to ticket page with payment data
    this.router.navigate(['/ticket'], {
      state: {
        ticketData: {
          ...this.paymentData,
          paymentId: paymentData.id,
          paymentMethod: 'paymaya',
          status: 'paid',
          purchaseDate: new Date().toISOString()
        }
      }
    });
  }

  async handleReservationSuccess(reservationData: any) {
    await this.showSuccessAlert('Reservation Confirmed!', 
      'Your seat has been reserved. Please pay with cash when boarding the bus.');
    
    // Navigate to ticket page with reservation data
    this.router.navigate(['/ticket'], {
      state: {
        ticketData: {
          ...this.paymentData,
          reservationId: reservationData.id,
          paymentMethod: 'cash',
          status: 'reserved',
          reservationDate: new Date().toISOString()
        }
      }
    });
  }

  async showPayMayaInfo() {
    const alert = await this.alertController.create({
      header: 'PayMaya Payment',
      message: `
        <p>PayMaya is a secure payment platform that accepts:</p>
        <ul>
          <li>Credit and Debit Cards (Visa, Mastercard)</li>
          <li>PayMaya Account Balance</li>
          <li>Online Banking</li>
          <li>Over-the-counter payments</li>
        </ul>
        <p>Your payment information is encrypted and secure.</p>
      `,
      buttons: ['OK']
    });
    await alert.present();
  }

  async showSuccessAlert(header: string, message: string) {
    const alert = await this.alertController.create({
      header: header,
      message: message,
      buttons: ['OK'],
      cssClass: 'success-alert'
    });
    await alert.present();
  }

  async showErrorAndGoBack(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message: message,
      buttons: [
        {
          text: 'OK',
          handler: () => {
            this.router.navigate(['/home']);
          }
        }
      ]
    });
    await alert.present();
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

  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      control?.markAsTouched({ onlySelf: true });
    });
  }

  goBack() {
    this.router.navigate(['/home']);
  }
}
