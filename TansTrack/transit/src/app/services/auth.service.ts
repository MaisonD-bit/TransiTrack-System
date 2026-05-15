import { Injectable } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private isLoggedInSubject = new BehaviorSubject<boolean>(false);
  public isLoggedIn$ = this.isLoggedInSubject.asObservable();
  
  private userSubject = new BehaviorSubject<any>(null);
  public user$ = this.userSubject.asObservable();

  constructor(private router: Router) {
    const driverId = sessionStorage.getItem('driverId');
    if (driverId) {
      this.isLoggedInSubject.next(true);
      this.userSubject.next({
        uid: driverId,
        email: sessionStorage.getItem('driverEmail'),
        displayName: sessionStorage.getItem('driverName')
      });
    }
  }

  login(driverId: string, driverName: string, email?: string) {
      sessionStorage.setItem('driverId', driverId);
      sessionStorage.setItem('driverName', driverName);
      if (email) sessionStorage.setItem('driverEmail', email);
      sessionStorage.setItem('currentUser', JSON.stringify({
          id: driverId,
          name: driverName,
          email: email
      }));
      this.isLoggedInSubject.next(true);
      this.userSubject.next({
          uid: driverId,
          email: email,
          displayName: driverName
      });
  }

  logout() {
    sessionStorage.removeItem('driverId');
    sessionStorage.removeItem('driverName');
    sessionStorage.removeItem('driverEmail');
    sessionStorage.removeItem('currentUser');
    this.isLoggedInSubject.next(false);
    this.userSubject.next(null);
    this.router.navigate(['/login']);
  }

  isAuthenticated(): boolean {
    return !!sessionStorage.getItem('driverId');
  }

  isLoggedIn(): boolean {
    return this.isAuthenticated();
  }

  getDriverId(): string | null {
    return sessionStorage.getItem('driverId');
  }
  getDriverName(): string | null {
    return sessionStorage.getItem('driverName');
  }
  getDriverEmail(): string | null {
    return sessionStorage.getItem('driverEmail');
  }
  getCurrentUser(): any {
    const userData = sessionStorage.getItem('currentUser');
    return userData ? JSON.parse(userData) : null;
  }

  async signIn(email: string, password: string) {
    // Implement your sign-in logic here, for example, calling an API
    // For demonstration, let's assume the sign-in is always successful
    const driverId = 'some-driver-id'; // This should come from your API response
    const driverName = 'Some Driver'; // This should come from your API response

    await this.login(driverId, driverName, email);
    // Navigate to the desired route after successful login
    await this.router.navigate(['/']);
  }

  async performLogout() {
    this.logout();
  }

  async sendPasswordResetEmail(email: string): Promise<void> {
    // Implement your password reset logic here (e.g., call your backend API)
    // For now, just log and resolve
    console.log(`Password reset requested for: ${email}`);
    return Promise.resolve();
  }
}