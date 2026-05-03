import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root' 
})
export class AuthService {  
  private apiUrl = `${environment.apiUrl}/commuters`;  // ✅ FIXED: /commuters not /auth
  private currentUser: any = null;

  constructor(private http: HttpClient) {
    this.loadCurrentUser();
  }

  private async loadCurrentUser() {
    const userData = localStorage.getItem('currentUser');
    if (userData) {
      try {
        this.currentUser = JSON.parse(userData);
      } catch (error) {
        console.error('Error parsing user data:', error);
        localStorage.removeItem('currentUser');
      }
    }
  }

  async getCurrentUser(): Promise<any> {
    if (!this.currentUser) {
      await this.loadCurrentUser();
    }
    return this.currentUser;
  }

  async login(email: string, password: string): Promise<any> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(`${this.apiUrl}/login`, { email, password })
      );

      const user = response.data || response.user || response.commuter || response;

      if (response.success && user) {
        this.currentUser = user;
        if (response.token) {
          localStorage.setItem('authToken', response.token);
        }
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        return this.currentUser;
      } else {
        throw new Error(response.message || 'Login failed');
      }
    } catch (error: any) {
      if (error instanceof Error && !error.message.includes('Http')) {
        throw error;
      }
      console.error('Login error:', error);
      throw new Error(error.error?.message || 'Login failed. Please check your credentials.');
    }
  }

  async register(
    first_name: string,
    last_name: string,
    email: string,
    phone: string,
    password: string,
    passwordConfirmation: string
  ): Promise<any> {
    try {
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        Accept: 'application/json'
      });

      const response: any = await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/register`,
          {
            first_name,
            last_name,
            email,
            phone,
            password,
            password_confirmation: passwordConfirmation
          },
          { headers }
        )
      );

      const user = response.data || response.user || response.commuter || response;

      if (response.success && user) {
        this.currentUser = user;
        localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
        return this.currentUser;
      } else {
        throw new Error(response.message || 'Registration failed');
      }
    } catch (error: any) {
      console.error('Register error:', error);
      throw new Error(error.error?.message || 'Registration failed. Please try again.');
    }
  }

  async updateUserProfile(profileData: any): Promise<boolean> {
    try {
      if (!this.currentUser) {
        await this.loadCurrentUser();
      }

      if (!this.currentUser?.id && !this.currentUser?._id) {
        throw new Error('No user logged in');
      }

      const userId = this.currentUser.id || this.currentUser._id;

      // Try API update
      try {
        const response: any = await firstValueFrom(
          this.http.put(`${this.apiUrl}/${userId}/profile`, profileData)
        );

        if (response.success) {
          this.currentUser = {
            ...this.currentUser,
            ...profileData
          };
          localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
          return true;
        }
      } catch (apiError) {
        console.warn('API update failed, updating locally:', apiError);
      }

      // Fallback: Update locally
      this.currentUser = {
        ...this.currentUser,
        ...profileData
      };
      localStorage.setItem('currentUser', JSON.stringify(this.currentUser));
      return true;

    } catch (error) {
      console.error('Error updating profile:', error);
      return false;
    }
  }

  async logout(): Promise<void> {
    try {
      const userId = this.currentUser?.id || this.currentUser?._id;
      if (userId) {
        await firstValueFrom(
          this.http.post(`${this.apiUrl}/${userId}/logout`, {})
        ).catch(err => console.warn('API logout failed:', err));
      }
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.currentUser = null;
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
    }
  }

  isLoggedIn(): boolean {
    return !!this.currentUser;
  }

  getUserId(): string | null {
    return this.currentUser?.id || this.currentUser?._id || null;
  }
}
