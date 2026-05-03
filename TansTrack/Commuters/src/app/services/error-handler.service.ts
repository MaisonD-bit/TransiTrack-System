import { Injectable } from '@angular/core';
import { ToastController } from '@ionic/angular';

export interface AppError {
  code?: string;
  message: string;
  statusCode?: number;
  originalError?: any;
}

@Injectable({
  providedIn: 'root'
})
export class ErrorHandlerService {
  constructor(private toastController: ToastController) {}

  /**
   * Handle HTTP errors with consistent messaging
   */
  handleHttpError(error: any): AppError {
    const appError: AppError = {
      originalError: error,
      statusCode: error?.status,
      code: error?.error?.code || 'HTTP_ERROR'
    };

    if (error?.status === 0) {
      appError.message = 'Network error. Please check your connection.';
      appError.code = 'NETWORK_ERROR';
    } else if (error?.status === 401) {
      appError.message = 'Session expired. Please login again.';
      appError.code = 'UNAUTHORIZED';
    } else if (error?.status === 403) {
      appError.message = 'Access denied. You do not have permission.';
      appError.code = 'FORBIDDEN';
    } else if (error?.status === 404) {
      appError.message = 'Resource not found.';
      appError.code = 'NOT_FOUND';
    } else if (error?.status === 500) {
      appError.message = 'Server error. Please try again later.';
      appError.code = 'SERVER_ERROR';
    } else if (error?.error?.message) {
      appError.message = error.error.message;
    } else if (error?.message) {
      appError.message = error.message;
    } else {
      appError.message = 'An unexpected error occurred.';
      appError.code = 'UNKNOWN_ERROR';
    }

    return appError;
  }

  /**
   * Handle validation errors
   */
  handleValidationError(field: string, error: string): AppError {
    return {
      code: 'VALIDATION_ERROR',
      message: `${field}: ${error}`
    };
  }

  /**
   * Handle permission errors
   */
  handlePermissionError(permission: string): AppError {
    return {
      code: 'PERMISSION_DENIED',
      message: `${permission} permission denied. Please enable in settings.`
    };
  }

  /**
   * Show error toast with optional duration
   */
  async showErrorToast(message: string, duration: number = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color: 'danger',
      icon: 'alert-circle'
    });
    await toast.present();
  }

  /**
   * Show success toast
   */
  async showSuccessToast(message: string, duration: number = 2000): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color: 'success',
      icon: 'checkmark-circle'
    });
    await toast.present();
  }

  /**
   * Show warning toast
   */
  async showWarningToast(message: string, duration: number = 3000): Promise<void> {
    const toast = await this.toastController.create({
      message,
      duration,
      position: 'bottom',
      color: 'warning',
      icon: 'warning'
    });
    await toast.present();
  }

  /**
   * Log error for debugging
   */
  logError(context: string, error: any): void {
    console.error(`[${context}]`, error);
  }
}
