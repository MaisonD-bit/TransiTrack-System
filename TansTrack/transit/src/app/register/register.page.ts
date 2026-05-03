import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { FormBuilder, FormGroup, Validators, AbstractControl } from '@angular/forms';
import { Router } from '@angular/router';
import { LoadingController, ToastController, AlertController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';
import { environment } from '../../environments/environment';

// Custom validator for password confirmation
function passwordMatchValidator(control: AbstractControl) {
  const password = control.get('password');
  const confirmPassword = control.get('confirmPassword');
  
  if (password && confirmPassword && password.value !== confirmPassword.value) {
    return { mismatch: true };
  }
  return null;
}

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false
})
export class RegisterPage implements OnInit {
  @ViewChild('fileInput', { static: false }) fileInput!: ElementRef;
  
  registerForm: FormGroup;
  showPassword = false;
  showConfirmPassword = false;
  errorMessage: string = '';
  isSubmitting = false;
  selectedPhoto: string | null = null;
  selectedPhotoFile: File | null = null;
  busOperators: any[] = []; 

  constructor(
    private formBuilder: FormBuilder,
    private authService: AuthService,
    private apiService: ApiService,
    private router: Router,
    private loadingController: LoadingController,
    private toastController: ToastController,
    private alertController: AlertController
  ) {
    this.registerForm = this.formBuilder.group({
      // Personal Information
      name: ['', [Validators.required, Validators.minLength(2)]],
      email: ['', [Validators.required, Validators.email]],
      contact_number: ['', [Validators.required, Validators.minLength(10)]],
      date_of_birth: ['', Validators.required],
      gender: ['', Validators.required],
      address: ['', [Validators.required, Validators.minLength(10)]],
      user_id: ['', Validators.required],
      
      // License Information
      license_number: ['', [Validators.required, Validators.minLength(5)]],
      license_expiry: ['', Validators.required],
      
      // Emergency Contact
      emergency_name: ['', [Validators.required, Validators.minLength(2)]],
      emergency_relation: ['', [Validators.required, Validators.minLength(2)]],
      emergency_contact: ['', [Validators.required, Validators.minLength(10)]],
      
      // Password
      password: ['', [Validators.required, Validators.minLength(6)]],
      confirmPassword: ['', Validators.required],
      
      // Terms
      agreeToTerms: [false, Validators.requiredTrue]
    }, { validators: passwordMatchValidator });
  }

  async ngOnInit() {
    // Check if already logged in
    if (this.authService.isLoggedIn()) {
      this.router.navigate(['/tabs/home']);
    }
    
    // Fetch bus operators
    console.log('Fetching bus operators...');
    this.apiService.get('v1/bus-operators').subscribe({
      next: (response) => {
        console.log('Bus operators response:', response);
        this.busOperators = response;
        
        if (this.busOperators.length === 0) {
          this.showToast('No active bus operators found', 'warning');
        }
      },
      error: (error) => {
        console.error('Error fetching bus operators:', error);
        this.showToast('Failed to load bus operators', 'danger');
      }
    });
  }

  selectPhoto() {
    this.fileInput.nativeElement.click();
  }

  onPhotoSelected(event: any) {
    const file = event.target.files[0];
    if (file) {
      // Check file size (2MB limit)
      if (file.size > 2 * 1024 * 1024) {
        this.showToast('Photo size must be less than 2MB', 'warning');
        return;
      }

      // Check file type
      if (!file.type.startsWith('image/')) {
        this.showToast('Please select a valid image file', 'warning');
        return;
      }

      this.selectedPhotoFile = file;

      // Create preview
      const reader = new FileReader();
      reader.onload = (e: any) => {
        this.selectedPhoto = e.target.result;
      };
      reader.readAsDataURL(file);
    }
  }

  async register() {
    // Clear previous error message
    this.errorMessage = '';

    // FIXED: Always allow button press, but validate on submit
    if (!this.registerForm.valid) {
      // Mark all fields as touched to show validation errors
      this.markFormGroupTouched(this.registerForm);
      
      // Show specific validation errors
      const errors = this.getFormValidationErrors();
      if (errors.length > 0) {
        this.errorMessage = 'Please fix the following errors:\n' + errors.join('\n');
        await this.showToast('Please check the form for errors', 'warning');
        
        // Scroll to first error
        const firstErrorElement = document.querySelector('ion-note[color="danger"]');
        if (firstErrorElement) {
          firstErrorElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
      return;
    }

    if (this.isSubmitting) {
      return; // Prevent double submission
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Creating your driver account...',
      duration: 30000
    });
    await loading.present();

    try {
      let photoBase64 = '';
      
      // Convert photo to base64 if selected
      if (this.selectedPhotoFile) {
        console.log('Converting photo to base64...');
        photoBase64 = await this.convertFileToBase64(this.selectedPhotoFile);
        console.log('Photo converted successfully, size:', photoBase64.length);
      }

      const formData = {
        name: this.registerForm.value.name,
        email: this.registerForm.value.email,
        password: this.registerForm.value.password,
        contact_number: this.registerForm.value.contact_number,
        date_of_birth: this.registerForm.value.date_of_birth,
        gender: this.registerForm.value.gender,
        address: this.registerForm.value.address,
        license_number: this.registerForm.value.license_number,
        license_expiry: this.registerForm.value.license_expiry,
        emergency_name: this.registerForm.value.emergency_name,
        emergency_relation: this.registerForm.value.emergency_relation,
        emergency_contact: this.registerForm.value.emergency_contact,
        user_id: this.registerForm.value.user_id,
        photo_base64: photoBase64
      };

      console.log('Sending registration data:', { 
        ...formData, 
        photo_base64: photoBase64 ? '[Base64 Data Present]' : '[No Photo]' 
      });

      this.apiService.registerDriver(formData).subscribe({
        next: async (response) => {
          await loading.dismiss();
          this.isSubmitting = false;
          
          console.log('Registration response:', response);
          
          if (response.success) {
            await this.showSuccessAlert();
          } else {
            this.errorMessage = response.message || 'Registration failed';
            await this.showToast(this.errorMessage, 'danger');
          }
        },
        error: async (error) => {
          await loading.dismiss();
          this.isSubmitting = false;
          
          // Enhanced error logging
          console.error('=== REGISTRATION ERROR DETAILS ===');
          console.error('Full error object:', error);
          console.error('Error status:', error.status);
          console.error('Error status text:', error.statusText);
          console.error('Error message:', error.message);
          console.error('Error error property:', error.error);
          console.error('Error headers:', error.headers);
          console.error('Error url:', error.url);
          console.error('================================');
          
          if (error.status === 422 && error.error?.errors) {
            // Validation errors from Laravel
            console.log('Validation errors:', error.error.errors);
            this.errorMessage = 'Please check the form for errors';
            await this.showValidationErrors(error.error.errors);
          } else if (error.status === 0) {
            // Network error - cannot reach server
            this.errorMessage = 'Cannot connect to server. Please check if the Laravel server is running.';
            await this.showToast(this.errorMessage, 'danger');
            console.error('Network error: Check if Laravel server is running on http://127.0.0.1:8000');
          } else if (error.status === 500) {
            // Internal server error
            this.errorMessage = 'Server error occurred. Please check Laravel logs.';
            await this.showToast(this.errorMessage, 'danger');
            console.error('Server error 500: Check Laravel logs for details');
          } else if (error.status === 404) {
            // Route not found
            this.errorMessage = 'API endpoint not found. Please check server configuration.';
            await this.showToast(this.errorMessage, 'danger');
            console.error('404 error: API route not found');
          } else if (error.status === 405) {
            // Method not allowed
            this.errorMessage = 'Invalid request method. Please contact support.';
            await this.showToast(this.errorMessage, 'danger');
            console.error('405 error: Method not allowed');
          } else {
            // Other errors
            this.errorMessage = error.error?.message || 'Registration failed. Please try again.';
            await this.showToast(this.errorMessage, 'danger');
          }
        }
      });
    } catch (error) {
      await loading.dismiss();
      this.isSubmitting = false;
      console.error('Error preparing registration data:', error);
      await this.showToast('Error preparing registration data', 'danger');
    }
  }

  // Helper method to mark all form fields as touched
  private markFormGroupTouched(formGroup: FormGroup) {
    Object.keys(formGroup.controls).forEach(field => {
      const control = formGroup.get(field);
      control?.markAsTouched({ onlySelf: true });
    });
  }

  // Helper method to get all form validation errors
  private getFormValidationErrors(): string[] {
    const errors: string[] = [];
    
    Object.keys(this.registerForm.controls).forEach(key => {
      const control = this.registerForm.get(key);
      if (control && !control.valid && control.touched) {
        const fieldName = this.getFieldDisplayName(key);
        if (control.errors?.['required']) {
          errors.push(`${fieldName} is required`);
        }
        if (control.errors?.['email']) {
          errors.push(`${fieldName} must be a valid email`);
        }
        if (control.errors?.['minlength']) {
          errors.push(`${fieldName} is too short`);
        }
      }
    });

    // Check for password mismatch
    if (this.registerForm.hasError('mismatch')) {
      errors.push('Passwords do not match');
    }

    return errors;
  }

  // Helper method to get user-friendly field names
  private getFieldDisplayName(fieldName: string): string {
    const fieldMap: { [key: string]: string } = {
      'name': 'Full Name',
      'email': 'Email Address',
      'contact_number': 'Contact Number',
      'date_of_birth': 'Date of Birth',
      'gender': 'Gender',
      'address': 'Address',
      'license_number': 'License Number',
      'license_expiry': 'License Expiry Date',
      'emergency_name': 'Emergency Contact Name',
      'emergency_relation': 'Emergency Relationship',
      'emergency_contact': 'Emergency Contact Number',
      'password': 'Password',
      'confirmPassword': 'Confirm Password',
      'agreeToTerms': 'Terms and Conditions'
    };
    return fieldMap[fieldName] || fieldName;
  }

  private convertFileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        resolve(result);
      };
      reader.onerror = error => reject(error);
      reader.readAsDataURL(file);
    });
  }

  async showSuccessAlert() {
    const alert = await this.alertController.create({
      header: 'Registration Successful!',
      message: 'Your driver account has been created and is pending approval. You will be notified once approved.',
      buttons: [
        {
          text: 'Continue to Login',
          handler: () => {
            this.router.navigate(['/login']);
          }
        }
      ],
      backdropDismiss: false
    });
    await alert.present();
  }

  async showValidationErrors(errors: any) {
    let errorMessage = 'Please fix the following errors:\n';
    for (const [field, messages] of Object.entries(errors)) {
      const fieldName = this.getFieldDisplayName(field);
      errorMessage += `• ${fieldName}: ${(messages as string[]).join(', ')}\n`;
    }
    
    const alert = await this.alertController.create({
      header: 'Validation Errors',
      message: errorMessage,
      buttons: ['OK']
    });
    await alert.present();
  }

  togglePasswordVisibility() {
    this.showPassword = !this.showPassword;
  }

  toggleConfirmPasswordVisibility() {
    this.showConfirmPassword = !this.showConfirmPassword;
  }

  async showTerms(event: Event) {
    event.preventDefault();
    const alert = await this.alertController.create({
      header: 'Terms and Conditions',
      message: 'By registering as a driver, you agree to follow all company policies, maintain a valid license, and provide safe transportation services.',
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 4000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }

  // Debug method to test API connection
  async testApiConnection() {
    console.log('Testing API connection...');
    
    try {
      // Test basic connectivity
      const response = await fetch('/api/v1/test');
      const data = await response.json();
      console.log('API test response:', data);
      await this.showToast('API connection successful!', 'success');
    } catch (error) {
      console.error('API test error:', error);
      await this.showToast('API connection failed', 'danger');
    }
  }
}