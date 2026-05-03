import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, Validators } from '@angular/forms';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { AlertController, LoadingController } from '@ionic/angular';
import { IonicModule } from '@ionic/angular';
import { AuthService } from '../services/auth.service';

@Component({
  selector: 'app-login',
  templateUrl: './login.page.html',
  styleUrls: ['./login.page.scss'],
  standalone: false,
  
})
export class LoginPage implements OnInit {
  loginForm!: FormGroup;
  errorMessage: string = '';
  isLoading = false;

  constructor(
    private fb: FormBuilder,
    private router: Router,
    private authService: AuthService,
    private alertController: AlertController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.loginForm = this.fb.group({
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(6)]]
    });
  }

  async login() {
    if (this.loginForm.invalid) {
      this.errorMessage = 'Please fill all fields correctly';
      return;
    }

    this.isLoading = true;
    this.errorMessage = '';

    const { email, password } = this.loginForm.value;

    const loading = await this.loadingController.create({
      message: 'Logging in...'
    });
    await loading.present();

    try {
      const user = await this.authService.login(email, password);
      
      console.log('Login successful:', user);
      await loading.dismiss();
      this.router.navigate(['/tabs/home'], { replaceUrl: true });
      
    } catch (error: any) {
      await loading.dismiss();
      console.error('Login error:', error);
      this.errorMessage = error.message || 'Login failed. Username or Password is incorrect.';
    } finally {
      this.isLoading = false;
    }
  }

  signUp() {
    this.router.navigate(['/register']);
  }

  async forgotPassword() {
    const alert = await this.alertController.create({
      header: 'Forgot Password',
      message: 'Contact support@transitrack.com for password reset.',
      buttons: ['OK']
    });
    await alert.present();
  }
}
