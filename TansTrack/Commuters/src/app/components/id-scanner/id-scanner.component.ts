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
      message: 'Reading ID...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      const scanResult = await this.idVerificationService.scanIdWithOCR(this.capturedImage);

      if (scanResult.success && scanResult.data?.text) {
        const text = scanResult.data.text;
        this.extractedData = this.parseDisplayData(text);

        // Detect actual ID type from card text and auto-correct if mismatched
        const detectedType = this.detectIdType(text);
        if (detectedType && detectedType !== this.selectedIdType) {
          const detectedLabel = detectedType === 'senior' ? 'Senior Citizen ID' : 'PWD ID';
          const selectedLabel = this.selectedIdType === 'senior' ? 'Senior Citizen ID' : 'PWD ID';
          this.selectedIdType = detectedType;
          await loading.dismiss();
          await this.showIdTypeMismatch(selectedLabel, detectedLabel);
          return;
        } else if (!detectedType) {
          await loading.dismiss();
          await this.showWarning('Could not confirm the ID type from the card. Please make sure you selected the correct type above before verifying.');
          return;
        }
      } else {
        // OCR failed — still allow proceeding, just no extracted info
        this.extractedData = { idNumber: null, name: null, expiryDate: null };
      }
    } catch (error) {
      console.error('Scan error:', error);
      this.extractedData = { idNumber: null, name: null, expiryDate: null };
    } finally {
      await loading.dismiss();
    }
  }

  private detectIdType(text: string): 'pwd' | 'senior' | null {
    const upper = text.toUpperCase();
    const isSenior = /SENIOR\s*CITIZEN|OSCA|OFFICE\s*OF\s*SENIOR/.test(upper);
    const isPwd = /\bPWD\b|PERSON[S]?\s*WITH\s*DISABILIT/.test(upper);

    if (isSenior && !isPwd) return 'senior';
    if (isPwd && !isSenior) return 'pwd';
    if (isSenior && isPwd) return null; // ambiguous
    return null; // unrecognizable
  }

  private async showIdTypeMismatch(selected: string, detected: string) {
    const alert = await this.alertController.create({
      header: 'ID Type Corrected',
      message: `You selected <strong>${selected}</strong> but we detected a <strong>${detected}</strong>. Switched to ${detected} verification automatically.`,
      buttons: ['OK']
    });
    await alert.present();
  }

  private parseDisplayData(text: string): any {
    // ID number: match "ID No. 8764" or "OSCA No. ..." or "PWD No. ..." specifically
    // Avoid matching substrings of words like NON-TRANSFERABLE
    const idNoMatch = text.match(/\bID\s*No\.?\s*(\d{3,10})/i)
      || text.match(/\bOSCA\s*(?:No\.?)?\s*([A-Z0-9\-]{3,15})/i)
      || text.match(/\bPWD\s*(?:ID)?\s*(?:No\.?)?\s*([A-Z0-9\-]{3,15})/i);
    const idNumber = idNoMatch ? idNoMatch[1].trim() : null;

    // Name: text after "Name :" up to a newline or known next field
    const nameMatch = text.match(/Name\s*[:\-]?\s*([A-Za-z\s\.,]+?)(?:\r?\n|Address|$)/i);
    const name = nameMatch ? nameMatch[1].trim() : null;

    // Date of issue or expiry
    const dateMatch = text.match(/(?:Date of Issue|Valid|Expir)[^\d]*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4})/i);
    const expiryDate = dateMatch ? dateMatch[1] : null;

    return { idNumber, name, expiryDate };
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