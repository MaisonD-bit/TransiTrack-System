import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private loadingElement: HTMLIonLoadingElement | null = null;

  constructor(private loadingController: LoadingController) {}

  async showLoading(message: string = 'Loading...'): Promise<void> {
    // Dismiss any existing loading
    await this.hideLoading();
    
    this.loadingElement = await this.loadingController.create({
      message,
      spinner: 'crescent',
      translucent: true,
      backdropDismiss: false
    });
    
    return this.loadingElement.present();
  }

  async hideLoading(): Promise<void> {
    if (this.loadingElement) {
      await this.loadingElement.dismiss();
      this.loadingElement = null;
    }
  }

  async showLoadingFor<T>(
    promise: Promise<T>, 
    message: string = 'Loading...'
  ): Promise<T> {
    try {
      await this.showLoading(message);
      const result = await promise;
      await this.hideLoading();
      return result;
    } catch (error) {
      await this.hideLoading();
      throw error;
    }
  }
}
