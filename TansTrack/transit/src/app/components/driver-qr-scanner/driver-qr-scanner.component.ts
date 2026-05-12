import {
  Component,
  EventEmitter,
  Output,
  OnDestroy,
  AfterViewInit,
  ElementRef,
  ViewChild,
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Html5Qrcode } from 'html5-qrcode';

@Component({
  selector: 'app-driver-qr-scanner',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './driver-qr-scanner.component.html',
  styleUrls: ['./driver-qr-scanner.component.scss'],
})
export class DriverQrScannerComponent implements AfterViewInit, OnDestroy {
  @Output() scannedRaw = new EventEmitter<string>();
  @Output() close = new EventEmitter<void>();

  @ViewChild('fileInput') fileInputRef?: ElementRef<HTMLInputElement>;

  readonly readerId = 'driver-ticket-qr-reader';
  readonly fileDecoderId = 'driver-ticket-qr-file-decoder';

  mode: 'camera' | 'upload' = 'camera';
  isScanning = false;
  isProcessingFile = false;
  error = '';
  hint = 'Point the camera at the commuter’s e-ticket QR';

  private scanner: Html5Qrcode | null = null;

  ngAfterViewInit(): void {
    this.setMode('camera');
  }

  setMode(m: 'camera' | 'upload'): void {
    if (m === this.mode && m === 'camera' && this.isScanning) {
      return;
    }
    this.mode = m;
    this.error = '';
    if (m === 'camera') {
      this.hint = 'Point the camera at the commuter’s e-ticket QR';
      void this.startCamera();
    } else {
      this.stopCamera();
      this.hint = 'Upload a clear photo of the e-ticket QR';
    }
  }

  async startCamera(): Promise<void> {
    this.error = '';
    try {
      this.scanner = new Html5Qrcode(this.readerId, { verbose: false });
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 260, height: 260 } },
        (decoded: string) => this.emitDecoded(decoded),
        () => {}
      );
      this.isScanning = true;
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      this.error = msg.includes('permission')
        ? 'Camera access denied. Allow camera or use Upload.'
        : 'Could not start camera. Try Upload instead.';
    }
  }

  private stopCamera(): void {
    if (this.scanner) {
      this.scanner
        .stop()
        .catch(() => {})
        .finally(() => {
          this.scanner = null;
        });
    }
    this.isScanning = false;
  }

  triggerFileInput(): void {
    const input = this.fileInputRef?.nativeElement;
    if (input) {
      input.value = '';
      input.click();
    }
  }

  async onFileSelected(event: Event): Promise<void> {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) {
      return;
    }
    this.isProcessingFile = true;
    this.error = '';
    try {
      const temp = new Html5Qrcode(this.fileDecoderId, { verbose: false });
      const decoded = await temp.scanFile(file, false);
      this.emitDecoded(decoded);
    } catch {
      this.error = 'Could not read a QR from that image. Try a clearer photo.';
    } finally {
      this.isProcessingFile = false;
    }
  }

  private emitDecoded(raw: string): void {
    const trimmed = String(raw || '').trim();
    if (!trimmed) {
      return;
    }
    this.stopCamera();
    this.scannedRaw.emit(trimmed);
  }

  dismiss(): void {
    this.stopCamera();
    this.close.emit();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }
}
