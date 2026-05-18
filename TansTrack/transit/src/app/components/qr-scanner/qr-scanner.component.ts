import {
  Component,
  Input,
  Output,
  EventEmitter,
  OnDestroy,
  ViewChild,
  ElementRef,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Html5Qrcode, Html5QrcodeCameraScanConfig } from 'html5-qrcode';

export interface ScannedTicket {
  ticketId: string;
  routeName: string;
  fare: number;
  issuedAt?: string;
}

type CameraConfig = string | MediaTrackConstraints;

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.scss'],
})
export class QrScannerComponent implements OnDestroy {
  @Input() set ready(value: boolean) {
    if (value && this.mode === 'camera') {
      setTimeout(() => void this.startCamera(), 400);
    }
  }

  @Output() scanned = new EventEmitter<ScannedTicket>();
  @Output() close = new EventEmitter<void>();
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  mode: 'camera' | 'upload' = 'camera';
  isScanning = false;
  isStartingCamera = false;
  isProcessingFile = false;
  error = '';
  hint = "Point your camera at the commuter's e-ticket QR code";

  private scanner: Html5Qrcode | null = null;
  private readonly READER_ID = 'driver-qr-reader-element';
  private readonly scanConfig: Html5QrcodeCameraScanConfig = {
    fps: 10,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1,
  };

  setMode(m: 'camera' | 'upload') {
    if (m === this.mode && (m !== 'camera' || this.isScanning)) {
      return;
    }
    this.mode = m;
    this.error = '';
    if (m === 'camera') {
      this.hint = "Point your camera at the commuter's e-ticket QR code";
      void this.startCamera();
    } else {
      void this.stopCamera();
      this.hint = 'Upload a photo of the commuter e-ticket QR code';
    }
  }

  /** Call after the host modal has finished opening. */
  async startCamera(): Promise<void> {
    if (this.mode !== 'camera' || this.isStartingCamera || this.isScanning) {
      return;
    }

    this.isStartingCamera = true;
    this.error = '';
    await this.stopCamera();

    const ready = await this.waitForReaderElement();
    if (!ready) {
      this.isStartingCamera = false;
      this.error = 'Scanner view is not ready. Close and open again, or use Upload QR.';
      return;
    }

    const configs = await this.getCameraConfigs();
    let lastError: unknown;

    for (const config of configs) {
      try {
        const scanner = new Html5Qrcode(this.READER_ID, { verbose: false });
        await scanner.start(
          config,
          this.scanConfig,
          (decoded: string) => this.handleResult(decoded),
          () => {}
        );
        this.scanner = scanner;
        this.isScanning = true;
        this.isStartingCamera = false;
        return;
      } catch (err) {
        lastError = err;
        await this.stopCamera();
      }
    }

    this.isStartingCamera = false;
    this.error = this.formatCameraError(lastError);
  }

  private async getCameraConfigs(): Promise<CameraConfig[]> {
    const configs: CameraConfig[] = [];

    try {
      const cameras = await Html5Qrcode.getCameras();
      if (cameras?.length) {
        const back = cameras.find((c) =>
          /back|rear|environment|trás|arrière/i.test(c.label)
        );
        const preferred = back ?? cameras[cameras.length - 1];
        for (const cam of cameras) {
          if (cam.id === preferred.id) {
            configs.push(cam.id);
          }
        }
        for (const cam of cameras) {
          if (!configs.includes(cam.id)) {
            configs.push(cam.id);
          }
        }
      }
    } catch {
      /* enumerateDevices may be blocked until permission is granted */
    }

    configs.push({ facingMode: 'environment' });
    configs.push({ facingMode: 'user' });
    return configs;
  }

  private async waitForReaderElement(maxMs = 3000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < maxMs) {
      const el = document.getElementById(this.READER_ID);
      if (el && el.offsetWidth > 0 && el.offsetHeight > 0) {
        return true;
      }
      await new Promise((r) => setTimeout(r, 80));
    }
    return false;
  }

  private formatCameraError(err: unknown): string {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === 'string'
          ? err
          : '';

    if (/permission|not allowed|denied/i.test(msg)) {
      return 'Camera access was denied. Allow camera in browser settings, then tap Retry.';
    }
    if (/not found|no device|devices/i.test(msg)) {
      return 'No camera found on this device. Use Upload QR or test on a phone with a camera.';
    }
    if (/secure|https/i.test(msg)) {
      return 'Camera requires HTTPS. Use Upload QR or open the app over HTTPS.';
    }
    return 'Could not start camera. Tap Retry or use Upload QR.';
  }

  private async stopCamera(): Promise<void> {
    const scanner = this.scanner;
    this.scanner = null;
    const wasScanning = this.isScanning;
    this.isScanning = false;
    this.isStartingCamera = false;
    if (!scanner || !wasScanning) {
      return;
    }
    try {
      await scanner.stop();
    } catch {
      /* already stopped */
    }
    try {
      scanner.clear();
    } catch {
      /* reader may already be cleared */
    }
  }

  triggerFileInput() {
    this.fileInputRef.nativeElement.value = '';
    this.fileInputRef.nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }

    this.isProcessingFile = true;
    this.error = '';

    try {
      const tempScanner = new Html5Qrcode('driver-qr-file-decoder', { verbose: false });
      const decoded = await tempScanner.scanFile(file, false);
      this.handleResult(decoded);
    } catch {
      this.error = 'Could not read a QR code from that image. Try a clearer photo.';
    } finally {
      this.isProcessingFile = false;
    }
  }

  private parseEticketPayload(raw: string): ScannedTicket | null {
    const parts = raw.split('|');
    if (parts.length < 3) {
      return null;
    }
    const fare = parseFloat(parts[2]);
    if (Number.isNaN(fare)) {
      return null;
    }
    return {
      ticketId: parts[0],
      routeName: parts[1],
      fare,
      issuedAt: parts[3] || undefined,
    };
  }

  private handleResult(raw: string) {
    const ticket = this.parseEticketPayload(raw);
    if (ticket) {
      void this.stopCamera();
      this.scanned.emit(ticket);
      return;
    }

    this.hint = 'Not a valid e-ticket QR. Ask the commuter to show their TransiTrack e-ticket.';
  }

  dismiss() {
    void this.stopCamera();
    this.close.emit();
  }

  ngOnDestroy() {
    void this.stopCamera();
  }
}
