import { Injectable } from '@angular/core';
import { LoadingController } from '@ionic/angular';

@Injectable({
  providedIn: 'root'
})
export class LoadingService {
  private activeLoaders = new Map<string, HTMLIonLoadingElement>();

  constructor(private loadingController: LoadingController) {}

  /**
   * Show loading spinner with message
   */
  async show(message: string = 'Loading...', id: string = 'default'): Promise<void> {
    // If loader already exists, dismiss it first
    if (this.activeLoaders.has(id)) {
      await this.hide(id);
    }

    const loader = await this.loadingController.create({
      message,
      spinner: 'crescent',
      translucent: true
    });

    this.activeLoaders.set(id, loader);
    await loader.present();
  }

  /**
   * Hide loading spinner
   */
  async hide(id: string = 'default'): Promise<void> {
    const loader = this.activeLoaders.get(id);
    if (loader) {
      await loader.dismiss();
      this.activeLoaders.delete(id);
    }
  }

  /**
   * Hide all active loaders
   */
  async hideAll(): Promise<void> {
    for (const loader of this.activeLoaders.values()) {
      await loader.dismiss();
    }
    this.activeLoaders.clear();
  }

  /**
   * Execute async operation with loading state
   */
  async withLoading<T>(
    operation: () => Promise<T>,
    message: string = 'Loading...',
    id: string = 'default'
  ): Promise<T> {
    try {
      await this.show(message, id);
      return await operation();
    } finally {
      await this.hide(id);
    }
  }
}
