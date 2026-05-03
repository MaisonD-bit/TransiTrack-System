import { Component, EventEmitter, Output, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule, AlertController, LoadingController, Platform } from '@ionic/angular';
import { IdVerificationService } from '../../services/idscanner.service';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';

@Component({
  selector: 'app-id-scanner',
  templateUrl: './id-scanner.component.html',
  styleUrls: ['./id-scanner.component.scss'],
  standalone: true,
  imports: [CommonModule, IonicModule, FormsModule]
})
export class IdScannerComponent {
  @Input() userId!: string;
  @Input() visible: boolean = false;
  
  @Output() scanComplete = new EventEmitter<any>();
  @Output() scanCancelled = new EventEmitter<void>();
  @Output() close = new EventEmitter<void>();
  
  capturedImage: string | null = null;
  selectedIdType: 'pwd' | 'senior' = 'pwd';
  extractedData: any = null;
  isProcessing = false;

  constructor(
    private idVerificationService: IdVerificationService,
    private alertController: AlertController,
    private loadingController: LoadingController,
    private platform: Platform
  ) {}

  async captureId() {
    try {
      // Request camera permissions
      const permissions = await Camera.checkPermissions();
      
      if (permissions.camera === 'denied' || permissions.photos === 'denied') {
        const requestResult = await Camera.requestPermissions();
        if (requestResult.camera === 'denied' || requestResult.photos === 'denied') {
          await this.showError('Camera permission denied. Please enable in settings.');
          return;
        }
      }

      // Open camera
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
        saveToGallery: false,
        correctOrientation: true
      });

      if (image.dataUrl) {
        this.capturedImage = image.dataUrl;
        await this.scanImage();
      }
    } catch (error: any) {
      console.error('Camera error:', error);
      
      if (error.message && error.message.includes('User cancelled')) {
        // User cancelled - do nothing
        return;
      }
      
      await this.showError('Failed to open camera. Please check app permissions in settings.');
    }
  }

  async selectFromGallery() {
    try {
      // Request photo permissions
      const permissions = await Camera.checkPermissions();
      
      if (permissions.photos === 'denied') {
        const requestResult = await Camera.requestPermissions();
        if (requestResult.photos === 'denied') {
          await this.showError('Gallery permission denied. Please enable in settings.');
          return;
        }
      }

      // Open gallery
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: false,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Photos,
        correctOrientation: true
      });

      if (image.dataUrl) {
        this.capturedImage = image.dataUrl;
        await this.scanImage();
      }
    } catch (error: any) {
      console.error('Gallery error:', error);
      
      if (error.message && error.message.includes('User cancelled')) {
        return;
      }
      
      await this.showError('Failed to access gallery. Please check app permissions.');
    }
  }

  // Fallback for web/browser
  triggerFileInput() {
    if (this.platform.is('capacitor') || this.platform.is('cordova')) {
      // On mobile, use camera
      this.captureId();
    } else {
      // On web, use file input
      const fileInput = document.getElementById('file-input') as HTMLInputElement;
      fileInput?.click();
    }
  }

  async onFileSelected(event: any) {
    const file = event.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      await this.showError('Please select an image file');
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      await this.showError('Image file is too large. Maximum size is 5MB.');
      return;
    }

    const reader = new FileReader();
    reader.onload = async (e: any) => {
      this.capturedImage = e.target.result;
      await this.scanImage();
    };
    reader.readAsDataURL(file);
  }

  async scanImage() {
    if (!this.capturedImage) return;

    const loading = await this.loadingController.create({
      message: 'Reading ID with OCR...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const scanResult = await this.idVerificationService.scanIdWithOCR(this.capturedImage);
      
      if (scanResult.success && scanResult.data.text) {
        this.extractedData = this.parseDisplayData(scanResult.data.text);
        
        if (!this.extractedData.idNumber) {
          await this.showWarning('Could not detect ID number. You can still proceed with manual verification.');
        }
      } else {
        await this.showError('Could not read ID. Please try again with a clearer image.');
      }
      
    } catch (error) {
      console.error('Scan error:', error);
      await this.showError('Failed to read ID. Please try again.');
    } finally {
      await loading.dismiss();
    }
  }

  private parseDisplayData(text: string): any {
    const upperText = text.toUpperCase();
    
    const idMatch = upperText.match(/(?:PWD|SENIOR|SC|ID|NO)[\s\-:#]*([A-Z0-9\-]{5,20})/i);
    const nameMatch = upperText.match(/(?:NAME|HOLDER)[\s\-:#]*([A-Z\s,\.]+)/i);
    const expiryMatch = upperText.match(/(?:VALID|EXPIR|UNTIL)[\s\-:#]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);

    return {
      idNumber: idMatch ? idMatch[1].trim() : null,
      name: nameMatch ? nameMatch[1].trim().split(/\n|\r/)[0] : null,
      expiryDate: expiryMatch ? expiryMatch[1] : null,
      confidence: text.length > 10 ? 0.85 : 0.5,
      rawText: text
    };
  }

  async verifyId() {
    if (!this.capturedImage || !this.userId) {
      await this.showError('Missing required information');
      return;
    }

    const loading = await this.loadingController.create({
      message: 'Verifying ID...',
      spinner: 'crescent'
    });
    await loading.present();
    this.isProcessing = true;

    try {
      const verifyResult = await this.idVerificationService.verifyId(
        this.userId,
        this.capturedImage,
        this.selectedIdType
      );

      if (verifyResult.success) {
        await this.idVerificationService.updateUserType(
          this.userId,
          this.selectedIdType,
          verifyResult.data?.idNumber
        );

        await loading.dismiss();
        await this.showSuccess('ID verified successfully! You are now eligible for discounts.');
        
        this.scanComplete.emit({
          verified: true,
          type: this.selectedIdType,
          idNumber: verifyResult.data?.idNumber,
          data: verifyResult.data
        });
        
        this.reset();
      } else {
        await loading.dismiss();
        await this.showError(verifyResult.error || 'Verification failed. Please try again.');
      }
      
    } catch (error) {
      await loading.dismiss();
      console.error('Verification error:', error);
      await this.showError('ID verification failed. Please try again.');
    } finally {
      this.isProcessing = false;
    }
  }

  reset() {
    this.capturedImage = null;
    this.extractedData = null;
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    if (fileInput) fileInput.value = '';
  }

  cancel() {
    this.reset();
    this.scanCancelled.emit();
    this.close.emit();
  }

  private async showError(message: string) {
    const alert = await this.alertController.create({
      header: 'Error',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showWarning(message: string) {
    const alert = await this.alertController.create({
      header: 'Warning',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  private async showSuccess(message: string) {
    const alert = await this.alertController.create({
      header: 'Success',
      message,
      buttons: ['OK']
    });
    await alert.present();
  }
}