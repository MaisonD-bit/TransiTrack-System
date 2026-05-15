import { Component, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController } from '@ionic/angular';
import { AuthService } from '../services/auth.service';
import { ApiService } from '../services/api.service';
import { firstValueFrom } from 'rxjs';
// ...existing code...
import { environment } from '../../environments/environment';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  isDevelopmentMode: boolean = !environment.production;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private alertController: AlertController,
    private apiService: ApiService
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async login() {
    if (this.loginForm.invalid) return;

    const { email, password } = this.loginForm.value;

    try {
      //   Use ApiService
      const response = await firstValueFrom(
        this.apiService.loginDriver({ email, password })
      );

      if (response.success && response.driver) {
        this.authService.login(response.driver.id, response.driver.name, response.driver.email);
        this.router.navigate(['/tabs/home']);
      } else {
        throw new Error(response.message || 'Invalid email or password');
      }
    } catch (error: any) {
      console.error('Login error:', error);
      this.errorMessage = error.message || 'Login failed';
    }
  }

  signUp() {
    console.log('Navigating to register page');
    this.router.navigate(['/register']);
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Forgot Password',
      message: 'Please enter your email address to reset your password.',
      inputs: [
        {
          name: 'email',
          type: 'email',
          placeholder: 'Email'
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reset Password',
          handler: async (data) => {
            if (!data.email) {
              this.errorMessage = 'Please enter your email address';
              return false;
            }
            
            try {
              // Remove Firebase password reset logic
              // You may want to implement your own password reset API here
              this.errorMessage = 'Password reset is not available.';
              return false;
            } catch (error: any) {
              this.errorMessage = error.message || 'Failed to send reset email';
              return false;
            }
          }
        }
      ]
    });

    await alert.present();
  }

  // Quick login for development mode
  async loginWithDevelopmentAccount() {
    try {
      console.log('Using development account to login');
      await this.authService.signIn('dev@example.com', 'password');
      this.router.navigate(['/tabs/home']);
    } catch (error) {
      console.error('Development login error:', error);
    }
  }
}