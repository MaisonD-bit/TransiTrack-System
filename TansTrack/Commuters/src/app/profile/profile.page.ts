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

  constructor(
    private alertController: AlertController,
    private toastController: ToastController,
    private authService: AuthService,
    private router: Router,
  ) {}

  async ngOnInit() {
    await this.loadProfile();
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
