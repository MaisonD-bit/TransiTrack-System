import { Component, OnInit, NgZone, OnDestroy } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { PaymentService } from '../services/payment.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit, OnDestroy {
  isEditing = false;
  showAddPaymentForm = false;
  showIdScanner = false;

  userProfile = {
    id: '',
    name: '',
    email: '',
    phone: '',
    passengerType: 'Regular' as 'Regular' | 'Student' | 'Senior' | 'PWD',
    idVerified: false,
    idNumber: null as string | null
  };

  newPaymentMethod = {
    type: 'cash',
    number: '',
    name: ''
  };

  paymentMethods: Array<{
    type: string;
    number: string;
    name: string;
    isDefault: boolean;
  }> = [];

  balances: { [number: string]: number | null } = {};
  balancesLoading = false;

  mayaPopupOpen = false;
  private pendingMayaLink: { number: string; name: string } | null = null;
  private mayaLinkHandler: ((e: MessageEvent) => void) | null = null;

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private authService: AuthService,
    private router: Router,
    private paymentService: PaymentService,
    private ngZone: NgZone
  ) {}

  async ngOnInit() {
    await this.loadProfile();
    this.loadPaymentMethods();
  }

  ngOnDestroy() {
    if (this.mayaLinkHandler) {
      window.removeEventListener('message', this.mayaLinkHandler);
    }
  }

  async loadProfile() {
    try {
      // Get current user from AuthService
      const currentUser = await this.authService.getCurrentUser();
      
      if (currentUser) {
        const fullName = currentUser.name
          || currentUser.fullName
          || `${currentUser.first_name || ''} ${currentUser.last_name || ''}`.trim()
          || '';
        this.userProfile = {
          id: currentUser.id || currentUser._id || '',
          name: fullName,
          email: currentUser.email || '',
          phone: currentUser.phone || currentUser.phoneNumber || '',
          passengerType: currentUser.passengerType || currentUser.passenger_type || currentUser.userType || 'Regular',
          idVerified: currentUser.idVerified ?? currentUser.id_verified ?? false,
          idNumber: currentUser.idNumber || currentUser.id_number || null
        };

        // Auto-detect student from email domain on every load
        if (this.isStudentEmail(this.userProfile.email)) {
          const changed = this.userProfile.passengerType !== 'Student' || !this.userProfile.idVerified;
          this.userProfile.passengerType = 'Student';
          this.userProfile.idVerified = true;
          if (changed) {
            await this.authService.updateUserProfile({
              passengerType: 'Student',
              idVerified: true
            });
          }
        }
      } else {
        // No user logged in, redirect to login
        const alert = await this.alertController.create({
          header: 'Not Logged In',
          message: 'Please log in to view your profile',
          buttons: [{
            text: 'OK',
            handler: () => {
              this.router.navigate(['/login']);
            }
          }]
        });
        await alert.present();
      }
    } catch (error) {
      console.error('Error loading profile:', error);
      const toast = await this.toastController.create({
        message: 'Failed to load profile',
        duration: 2000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  private isStudentEmail(email: string): boolean {
    const domain = email.split('@')[1]?.toLowerCase() || '';
    return domain.endsWith('.edu.ph') || domain.endsWith('.edu');
  }

  async saveProfile() {
    try {
      // Auto-verify student if school email is entered
      if (this.isStudentEmail(this.userProfile.email) && !this.userProfile.idVerified) {
        this.userProfile.passengerType = 'Student';
        this.userProfile.idVerified = true;
      }

      // Update via AuthService/API
      const updated = await this.authService.updateUserProfile({
        name: this.userProfile.name,
        email: this.userProfile.email,
        phone: this.userProfile.phone,
        passengerType: this.userProfile.passengerType,
        idVerified: this.userProfile.idVerified,
        idNumber: this.userProfile.idNumber
      });

      if (updated) {
        this.isEditing = false;

        const message = this.userProfile.passengerType === 'Student' && this.userProfile.idVerified
          ? 'Profile updated! Student discount applied via school email.'
          : 'Profile updated successfully';

        const toast = await this.toastController.create({
          message,
          duration: 3000,
          color: 'success',
          position: 'bottom'
        });
        await toast.present();
      } else {
        throw new Error('Update failed');
      }
    } catch (error) {
      console.error('Error saving profile:', error);
      const toast = await this.toastController.create({
        message: 'Failed to update profile',
        duration: 2000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  async onIdScanComplete(result: any) {
    console.log('ID scan complete:', result);
    
    if (result.verified) {
      this.userProfile.idVerified = true;
      this.userProfile.idNumber = result.idNumber;
      this.userProfile.passengerType = result.type === 'pwd' ? 'PWD' : 'Senior';
      
      // Save to backend
      await this.saveProfile();
      
      const toast = await this.toastController.create({
        message: '✅ ID verified successfully! You are now eligible for discounts.',
        duration: 3000,
        color: 'success',
        position: 'top'
      });
      await toast.present();
    }
    
    this.showIdScanner = false;
  }

  loadPaymentMethods() {
    const saved = localStorage.getItem(`paymentMethods_${this.userProfile.id}`);
    if (saved) {
      this.paymentMethods = JSON.parse(saved);
      this.loadBalances();
    }
  }

  async loadBalances() {
    this.balancesLoading = true;
    const ewallets = this.paymentMethods.filter(m => m.type === 'gcash');
    for (const method of ewallets) {
      try {
        this.balances[method.number] = await this.paymentService.getEWalletBalance(method.number);
      } catch {
        this.balances[method.number] = null;
      }
    }
    this.balancesLoading = false;
  }

  async addPaymentMethod() {
    if (this.newPaymentMethod.type === 'paymaya') {
      await this.openMayaLinkFlow();
      return;
    }

    if (!this.newPaymentMethod.type || !this.newPaymentMethod.number || !this.newPaymentMethod.name) {
      const alert = await this.alertController.create({
        header: 'Missing Information',
        message: 'Please fill in all fields',
        buttons: ['OK']
      });
      await alert.present();
      return;
    }

    const method = {
      ...this.newPaymentMethod,
      isDefault: this.paymentMethods.length === 0
    };

    this.paymentMethods.push(method);
    localStorage.setItem(`paymentMethods_${this.userProfile.id}`, JSON.stringify(this.paymentMethods));

    this.newPaymentMethod = { type: 'gcash', number: '', name: '' };
    this.showAddPaymentForm = false;

    const toast = await this.toastController.create({
      message: 'Payment method added successfully',
      duration: 2000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
  }

  async openMayaLinkFlow() {
    if (!this.newPaymentMethod.number) {
      const toast = await this.toastController.create({
        message: 'Please enter your Maya phone number first',
        duration: 2000,
        color: 'warning',
        position: 'bottom'
      });
      await toast.present();
      return;
    }

    const loading = await this.toastController.create({
      message: 'Opening Maya...',
      duration: 3000,
      color: 'primary',
      position: 'bottom'
    });
    await loading.present();

    const result = await this.paymentService.createMayaCheckout({
      amount: 1,
      route_name: 'Account Verification',
      commuter_name: this.newPaymentMethod.name || this.userProfile.name
    });

    if (!result.success || !result.checkout_url) {
      const toast = await this.toastController.create({
        message: result.message || 'Could not open Maya. Try again.',
        duration: 3000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
      return;
    }

    localStorage.setItem('transittrack_app_origin', window.location.origin);
    this.pendingMayaLink = {
      number: this.newPaymentMethod.number,
      name: this.newPaymentMethod.name || this.userProfile.name
    };

    const popup = window.open(
      result.checkout_url,
      'maya_link',
      'width=520,height=680,top=100,left=200,scrollbars=yes'
    );

    if (!popup) {
      this.mayaPopupOpen = false;
      const toast = await this.toastController.create({
        message: 'Popup blocked — please allow popups for this site and try again.',
        duration: 4000,
        color: 'warning',
        position: 'top'
      });
      await toast.present();
      return;
    }

    this.mayaPopupOpen = true;

    if (this.mayaLinkHandler) {
      window.removeEventListener('message', this.mayaLinkHandler);
    }

    this.mayaLinkHandler = (event: MessageEvent) => {
      if (event.data?.type !== 'MAYA_PAYMENT_RESULT') return;
      window.removeEventListener('message', this.mayaLinkHandler!);
      this.mayaLinkHandler = null;

      this.ngZone.run(async () => {
        this.mayaPopupOpen = false;
        if (event.data.status === 'success') {
          await this.saveMayaAccount();
        } else {
          const toast = await this.toastController.create({
            message: 'Maya verification was not completed.',
            duration: 3000,
            color: 'warning',
            position: 'bottom'
          });
          await toast.present();
        }
      });
    };

    window.addEventListener('message', this.mayaLinkHandler);

    // Poll popup.closed as fallback
    const pollInterval = setInterval(() => {
      if (!popup.closed) return;
      clearInterval(pollInterval);
      if (this.mayaLinkHandler) {
        window.removeEventListener('message', this.mayaLinkHandler);
        this.mayaLinkHandler = null;
      }
      this.ngZone.run(async () => {
        const flag = localStorage.getItem('maya_link_success');
        if (flag === '1') {
          localStorage.removeItem('maya_link_success');
          this.mayaPopupOpen = false;
          await this.saveMayaAccount();
        }
        // If no flag, user closed without paying — mayaPopupOpen stays true
        // so they can still click "I've Paid" manually
      });
    }, 800);
  }

  async confirmMayaManually() {
    this.mayaPopupOpen = false;
    if (this.mayaLinkHandler) {
      window.removeEventListener('message', this.mayaLinkHandler);
      this.mayaLinkHandler = null;
    }
    await this.saveMayaAccount();
  }

  private async saveMayaAccount() {
    const method = {
      type: 'paymaya',
      number: this.pendingMayaLink!.number,
      name: this.pendingMayaLink!.name,
      isDefault: this.paymentMethods.length === 0
    };

    this.paymentMethods.push(method);
    localStorage.setItem(`paymentMethods_${this.userProfile.id}`, JSON.stringify(this.paymentMethods));

    this.pendingMayaLink = null;
    this.mayaPopupOpen = false;
    this.newPaymentMethod = { type: 'gcash', number: '', name: '' };
    this.showAddPaymentForm = false;

    const toast = await this.toastController.create({
      message: 'Maya account linked successfully!',
      duration: 3000,
      color: 'success',
      position: 'bottom'
    });
    await toast.present();
  }

  async removePaymentMethod(index: number) {
    const alert = await this.alertController.create({
      header: 'Remove Payment Method',
      message: 'Are you sure you want to remove this payment method?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Remove',
          role: 'destructive',
          handler: () => {
            this.paymentMethods.splice(index, 1);
            localStorage.setItem(`paymentMethods_${this.userProfile.id}`, JSON.stringify(this.paymentMethods));
            
            this.toastController.create({
              message: 'Payment method removed',
              duration: 2000,
              color: 'danger',
              position: 'bottom'
            }).then(toast => toast.present());
          }
        }
      ]
    });
    await alert.present();
  }

  setDefaultPayment(index: number) {
    this.paymentMethods.forEach((method, i) => {
      method.isDefault = i === index;
    });
    localStorage.setItem(`paymentMethods_${this.userProfile.id}`, JSON.stringify(this.paymentMethods));

    this.toastController.create({
      message: 'Default payment method updated',
      duration: 2000,
      color: 'success',
      position: 'bottom'
    }).then(toast => toast.present());
  }

  getPaymentIcon(type: string): string {
    const icons: { [key: string]: string } = {
      'gcash': 'phone-portrait',
      'paymaya': 'card',
      'cash': 'cash'
    };
    return icons[type] || 'wallet';
  }

  getPaymentLabel(type: string): string {
    const labels: { [key: string]: string } = {
      'gcash': 'GCash',
      'paymaya': 'PayMaya',
      'cash': 'Cash'
    };
    return labels[type] || type;
  }

  maskNumber(number: string): string {
    if (number.length <= 4) return number;
    const last4 = number.slice(-4);
    return `**** **** ${last4}`;
  }

  async logout() {
    const alert = await this.alertController.create({
      header: 'Logout',
      message: 'Are you sure you want to logout?',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Logout',
          role: 'destructive',
          handler: async () => {
            await this.authService.logout();
            this.router.navigate(['/login']);
          }
        }
      ]
    });
    await alert.present();
  }
}
