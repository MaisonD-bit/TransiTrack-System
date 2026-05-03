import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AuthService } from '../services/auth.service';
import { AlertController, LoadingController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';

@Component({
  selector: 'app-register',
  templateUrl: './register.page.html',
  styleUrls: ['./register.page.scss'],
  standalone: false,
  
})
export class RegisterPage implements OnInit {
  registerForm: FormGroup;
  isLoading = false;
  showPassword = false;
  showConfirmPassword = false;
  termsAccepted = false;

  constructor(
    private fb: FormBuilder,
    private authService: AuthService,
    private router: Router,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController
  ) {
    this.registerForm = this.fb.group({
      firstName: ['', [Validators.required, Validators.minLength(2)]],
      lastName: ['', [Validators.required, Validators.minLength(2)]],
      middleName: [''],
      email: ['', [Validators.required, Validators.email]],
      address: ['', Validators.required],
      contactNumber: ['', [Validators.required, Validators.pattern(/^\d{10}$/)]],
      gender: ['', Validators.required],
      password: ['', [Validators.required, Validators.minLength(8), this.passwordStrengthValidator]],
      confirmPassword: ['', [Validators.required]],
      terms: [false, Validators.requiredTrue]
    }, { validators: this.passwordMatchValidator });
  }

  ngOnInit() {}

  passwordStrengthValidator(control: any) {
    const password = control.value;
    if (!password) return null;
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumeric = /[0-9]/.test(password);
    const hasMinLength = password.length >= 8;
    
    return hasUpperCase && hasLowerCase && hasNumeric && hasMinLength 
      ? null 
      : { weakPassword: true };
  }

  passwordMatchValidator(form: FormGroup) {
    return form.get('password')?.value === form.get('confirmPassword')?.value 
      ? null 
      : { mismatch: true };
  }

  async onSubmit() {
    if (this.registerForm.invalid) {
      return;
    }

    this.isLoading = true;
    const loading = await this.loadingCtrl.create({
      message: 'Creating account...'
    });
    await loading.present();

    try {
      const { firstName, lastName, email, password, confirmPassword, contactNumber } = this.registerForm.value;
      await this.authService.register(
        firstName,
        lastName,
        email,
        contactNumber,
        password,
        confirmPassword
      );
      await loading.dismiss();
      
      const toast = await this.toastCtrl.create({
        message: 'Account created successfully! Welcome to TransitTrack.',
        duration: 3000,
        color: 'success'
      });
      await toast.present();
      
      await this.router.navigate(['/home'], { replaceUrl: true });
    } catch (error: any) {
      await loading.dismiss();
      const alert = await this.alertCtrl.create({
        header: 'Registration Failed',
        message: error.message,
        buttons: ['OK']
      });
      await alert.present();
    } finally {
      this.isLoading = false;
    }
  }

  togglePasswordVisibility(field: 'password' | 'confirmPassword') {
    if (field === 'password') {
      this.showPassword = !this.showPassword;
    } else {
      this.showConfirmPassword = !this.showConfirmPassword;
    }
  }

  goToLogin() {
    this.router.navigate(['/login']);
  }

  middleInitial(middleIn: 'middleName'):string{
    if (middleIn === 'middleName') {
      return this.registerForm.value.middleName ? this.registerForm.value.middleName.charAt(0).toUpperCase() + '.' : '';
    }
    return '';
  }
}
