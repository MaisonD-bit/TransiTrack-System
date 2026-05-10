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

  private getHeaders(): HttpHeaders {
    const headers: { [key: string]: string } = {
      'Content-Type': 'application/json',
      'Accept': 'application/json'
    };
    if (this.apiUrl.includes('ngrok-free')) {
      headers['ngrok-skip-browser-warning'] = 'true';
    }
    return new HttpHeaders(headers);
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
        this.http.post(`${this.apiUrl}/login`, { email, password }, { headers: this.getHeaders() })
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
    contact_number: string,
    password: string,
    passwordConfirmation: string,
    options: { middle_name?: string; address?: string; gender?: string } = {}
  ): Promise<any> {
    try {
      const response: any = await firstValueFrom(
        this.http.post(
          `${this.apiUrl}/register`,
          {
            first_name,
            last_name,
            middle_name: options.middle_name || null,
            email,
            contact_number,
            address: options.address || null,
            gender: options.gender || null,
            password,
            password_confirmation: passwordConfirmation
          },
          { headers: this.getHeaders() }
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
      // Extract first validation error message if present
      const errBody = error.error;
      if (errBody?.errors) {
        const firstField = Object.keys(errBody.errors)[0];
        const firstMsg = errBody.errors[firstField]?.[0];
        throw new Error(firstMsg || errBody.message || 'Registration failed. Please try again.');
      }
      throw new Error(errBody?.message || 'Registration failed. Please try again.');
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
      // Laravel: POST /api/v1/commuters/logout (no user id in path)
      const token = localStorage.getItem('authToken');
      const headers = token
        ? new HttpHeaders({
            'Content-Type': 'application/json',
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          })
        : undefined;
      await firstValueFrom(
        this.http.post(`${this.apiUrl}/logout`, {}, { headers: headers ?? this.getHeaders() })
      ).catch(err => console.warn('API logout failed:', err));
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      this.currentUser = null;
      localStorage.removeItem('currentUser');
      localStorage.removeItem('authToken');
    }
  }

  isLoggedIn(): boolean {
    if (this.currentUser) return true;
    return !!localStorage.getItem('currentUser');
  }

  getUserId(): string | null {
    return this.currentUser?.id || this.currentUser?._id || null;
  }
}
