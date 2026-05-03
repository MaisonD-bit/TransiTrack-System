import { ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastController } from '@ionic/angular';

@Injectable()
export class GlobalErrorHandler implements ErrorHandler {
  
  private toastController = inject(ToastController);

  handleError(error: any): void {
    console.error('Global error handler caught an error:', error);
    
    // Handle error asynchronously without blocking
    this.handleErrorAsync(error).catch(handlerError => {
      console.error('Error in error handler:', handlerError);
    });
  }

  private async handleErrorAsync(error: any): Promise<void> {
    
    // Extract meaningful error message
    let message = 'An unexpected error occurred';
    
    if (error?.message) {
      message = error.message;
    } else if (error?.error?.message) {
      message = error.error.message;
    } else if (typeof error === 'string') {
      message = error;
    }

    // Show user-friendly toast message for Firebase errors
    if (this.isFirebaseError(error)) {
      message = this.getFirebaseErrorMessage(error);
    }

    // Show toast notification to user (non-blocking)
    try {
      const toast = await this.toastController.create({
        message: message,
        duration: 4000,
        color: 'danger',
        position: 'top',
        buttons: [
          {
            text: 'Dismiss',
            role: 'cancel'
          }
        ]
      });
      await toast.present();
    } catch (toastError) {
      console.error('Failed to show error toast:', toastError);
    }
  }

  private isFirebaseError(error: any): boolean {
    return error?.code && error.code.startsWith('auth/') || 
           error?.code && error.code.startsWith('firestore/');
  }

  private getFirebaseErrorMessage(error: any): string {
    const code = error?.code || '';
    
    switch (code) {
      case 'auth/user-not-found':
        return 'No account found with this email address';
      case 'auth/wrong-password':
        return 'Incorrect password';
      case 'auth/invalid-email':
        return 'Please enter a valid email address';
      case 'auth/weak-password':
        return 'Password should be at least 6 characters';
      case 'auth/email-already-in-use':
        return 'An account with this email already exists';
      case 'auth/network-request-failed':
        return 'Network error - please check your connection';
      case 'firestore/permission-denied':
        return 'You do not have permission to perform this action';
      case 'firestore/unavailable':
        return 'Service temporarily unavailable - please try again';
      default:
        return error?.message || 'An error occurred with the service';
    }
  }
}
