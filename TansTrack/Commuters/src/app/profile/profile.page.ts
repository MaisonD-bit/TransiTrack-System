import { Component, OnInit } from '@angular/core';
import { AlertController, ToastController } from '@ionic/angular';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-profile',
  templateUrl: './profile.page.html',
  styleUrls: ['./profile.page.scss'],
  standalone: false
})
export class ProfilePage implements OnInit {
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

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private authService: AuthService,
    private router: Router
  ) {}

  async ngOnInit() {
    await this.loadProfile();
    this.loadPaymentMethods();
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
    // Load from localStorage for now (can be moved to API later)
    const saved = localStorage.getItem(`paymentMethods_${this.userProfile.id}`);
    if (saved) {
      this.paymentMethods = JSON.parse(saved);
    }
  }

  async addPaymentMethod() {
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
