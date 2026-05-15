import { Component, Input, Output, EventEmitter, OnDestroy, AfterViewInit, ViewChild, ElementRef, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { Html5Qrcode } from 'html5-qrcode';
import QRCode from 'qrcode';

export interface ScannedPayment {
  scheduleId: number;
  routeId: number;
  routeName: string;
  fareOverride?: number;
  ticketIdOverride?: string;
}

@Component({
  selector: 'app-qr-scanner',
  standalone: true,
  imports: [CommonModule, IonicModule],
  templateUrl: './qr-scanner.component.html',
  styleUrls: ['./qr-scanner.component.scss']
})
export class QrScannerComponent implements AfterViewInit, OnChanges, OnDestroy {
  @Input() eTicketPayload: string = '';
  @Input() defaultMode: 'camera' | 'upload' | 'eticket' = 'camera';
  @Output() scanned = new EventEmitter<ScannedPayment>();
  @Output() close = new EventEmitter<void>();
  @ViewChild('fileInput') fileInputRef!: ElementRef<HTMLInputElement>;

  mode: 'camera' | 'upload' | 'eticket' = 'camera';
  isScanning = false;
  isProcessingFile = false;
  error = '';
  hint = "Point your camera at the QR code on the conductor's device";
  eTicketQrDataUrl = '';

  private scanner: Html5Qrcode | null = null;
  private readonly READER_ID = 'qr-reader-element';

  ngAfterViewInit() {
    this.setMode(this.defaultMode);
  }

  ngOnChanges() {
    if (this.eTicketPayload) {
      QRCode.toDataURL(this.eTicketPayload, { width: 220, margin: 1 })
        .then(url => this.eTicketQrDataUrl = url)
        .catch(() => this.eTicketQrDataUrl = '');
    }
  }

  setMode(m: 'camera' | 'upload' | 'eticket') {
    if (m === this.mode && this.isScanning) return;
    this.mode = m;
    this.error = '';
    if (m === 'camera') {
      this.hint = "Point your camera at the QR code on the conductor's device";
      this.startCamera();
    } else {
      this.stopCamera();
      this.hint = m === 'eticket'
        ? 'Your e-ticket QR is ready — tap Confirm Payment to proceed'
        : 'Upload a screenshot of the payment QR or your e-ticket';
    }
  }

  confirmETicket() {
    if (this.eTicketPayload) {
      this.handleResult(this.eTicketPayload);
    }
  }

  async startCamera() {
    this.error = '';
    try {
      this.scanner = new Html5Qrcode(this.READER_ID, { verbose: false });
      await this.scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 240, height: 240 } },
        (decoded: string) => this.handleResult(decoded),
        () => {}
      );
      this.isScanning = true;
    } catch (e: any) {
      this.error = e?.message?.includes('permission')
        ? 'Camera access was denied. Please allow camera permission and try again.'
        : 'Could not start camera. Switch to Upload mode instead.';
    }
  }

  private stopCamera() {
    if (this.scanner) {
      this.scanner.stop().catch(() => {}).finally(() => { this.scanner = null; });
    }
    this.isScanning = false;
  }

  triggerFileInput() {
    this.fileInputRef.nativeElement.value = '';
    this.fileInputRef.nativeElement.click();
  }

  async onFileSelected(event: Event) {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;

    this.isProcessingFile = true;
    this.error = '';

    try {
      const tempScanner = new Html5Qrcode('qr-file-decoder', { verbose: false });
      const decoded = await tempScanner.scanFile(file, false);
      this.handleResult(decoded);
    } catch {
      this.error = 'Could not read a QR code from that image. Try a clearer photo.';
    } finally {
      this.isProcessingFile = false;
    }
  }

  private handleResult(raw: string) {
    const parts = raw.split('|');

    // Conductor payment QR: TT-PAY|scheduleId|routeId|routeName
    if (parts.length >= 4 && parts[0] === 'TT-PAY') {
      this.stopCamera();
      this.scanned.emit({
        scheduleId: parseInt(parts[1], 10),
        routeId: parseInt(parts[2], 10),
        routeName: parts[3]
      });
      return;
    }

    // Own e-ticket QR: ticketID|routeName|fare|issuedAt
    if (parts.length >= 3 && !isNaN(parseFloat(parts[2]))) {
      this.stopCamera();
      this.scanned.emit({
        scheduleId: 0,
        routeId: 0,
        routeName: parts[1],
        fareOverride: parseFloat(parts[2]),
        ticketIdOverride: parts[0]
      });
      return;
    }

    this.hint = "Not a valid QR. Use the conductor's payment QR or your e-ticket QR.";
  }

  dismiss() {
    this.stopCamera();
    this.close.emit();
  }

  ngOnDestroy() {
    this.stopCamera();
  }
}
