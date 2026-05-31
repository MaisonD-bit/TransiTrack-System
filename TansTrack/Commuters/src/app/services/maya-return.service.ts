import { Injectable, NgZone } from '@angular/core';
import { Router } from '@angular/router';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { App } from '@capacitor/app';
import { Capacitor } from '@capacitor/core';
import { Subject, firstValueFrom } from 'rxjs';
import { environment } from '../../environments/environment';

/** Custom URL scheme registered in AndroidManifest — opens the Commuters app after PayMaya. */
export const MAYA_APP_RETURN_BASE = 'io.ionic.starter://maya-return';

export const MAYA_PENDING_STORAGE_KEY = 'transitrack_maya_pending_v1';
export const MAYA_DEEP_LINK_STORAGE_KEY = 'maya_deep_link_url';
export const MAYA_SUCCESS_UI_KEY = 'transitrack_maya_success_ui';

export interface MayaReturnParams {
  status: string;
  ticketId: string;
}

export interface MayaSuccessUi {
  ticketId: string;
  fare: number;
  routeName: string;
  routeId?: string;
  scheduleId?: number | null;
  paidAt: string;
}

/** Survives WebView reload / Chrome redirect (unlike sessionStorage). */
export interface MayaPendingSnapshot {
  payment: {
    scheduleId: number;
    routeId: number;
    routeName: string;
    fareOverride?: number;
    ticketIdOverride?: string;
  };
  fare: number;
  ticketId: string;
  routeId: string;
  scheduleId: number | null;
  fromStopIndex: number;
  ticketPersistedToBackend: boolean;
  commuterId?: number | null;
}

@Injectable({ providedIn: 'root' })
export class MayaReturnService {
  private initialized = false;
  private readonly return$ = new Subject<MayaReturnParams>();
  private processingReturn = false;

  constructor(
    private readonly router: Router,
    private readonly http: HttpClient,
    private readonly ngZone: NgZone
  ) {}

  onMayaReturn() {
    return this.return$.asObservable();
  }

  initDeepLinkListener(): void {
    if (this.initialized) {
      void this.processStoredReturn();
      return;
    }
    this.initialized = true;

    void App.addListener('appUrlOpen', ({ url }) => {
      void this.handleDeepLink(url);
    });

    void App.getLaunchUrl().then((result) => {
      if (result?.url) {
        void this.handleDeepLink(result.url);
      } else {
        void this.processStoredReturn();
      }
    });
  }

  private async handleDeepLink(url: string): Promise<void> {
    if (!url?.includes('maya-return')) {
      return;
    }
    localStorage.setItem(MAYA_DEEP_LINK_STORAGE_KEY, url);
    const parsed = this.parseReturnUrl(url);
    if (!parsed) {
      return;
    }
    await this.processReturn(parsed);
  }

  /** Run finalize even if HomePage is not constructed yet. */
  async processReturn(parsed: MayaReturnParams): Promise<void> {
    if (this.processingReturn) {
      return;
    }
    this.processingReturn = true;

    try {
      this.ngZone.run(() => {
        void this.router.navigateByUrl('/tabs/home', { replaceUrl: true });
      });

      if (parsed.status !== 'success' || !parsed.ticketId) {
        this.return$.next(parsed);
        return;
      }

      const snapshot = this.peekPendingCheckout();
      const headers = new HttpHeaders({
        'Content-Type': 'application/json',
        'ngrok-skip-browser-warning': 'true',
      });

      try {
        const res: any = await firstValueFrom(
          this.http.post(
            `${environment.apiUrl}/commuter/maya/finalize`,
            {
              public_ticket_id: parsed.ticketId,
              route_id: snapshot?.payment?.routeId || parseInt(snapshot?.routeId ?? '0', 10) || null,
              schedule_id: snapshot?.scheduleId ?? snapshot?.payment?.scheduleId ?? null,
              fare: snapshot?.fare ?? snapshot?.payment?.fareOverride ?? null,
              commuter_id: snapshot?.commuterId ?? undefined,
              from_stop_index: snapshot?.fromStopIndex ?? undefined,
            },
            { headers }
          )
        );

        if (res?.success) {
          const successUi: MayaSuccessUi = {
            ticketId: res.data?.public_ticket_id || parsed.ticketId,
            fare: res.data?.fare ?? snapshot?.fare ?? 0,
            routeName: snapshot?.payment?.routeName ?? '',
            routeId: snapshot?.routeId,
            scheduleId: res.data?.schedule_id ?? snapshot?.scheduleId ?? snapshot?.payment?.scheduleId ?? null,
            paidAt: new Date().toISOString(),
          };
          localStorage.setItem(MAYA_SUCCESS_UI_KEY, JSON.stringify(successUi));
          localStorage.removeItem(MAYA_PENDING_STORAGE_KEY);
        }
      } catch (err) {
        console.error('[MayaReturn] finalize API failed', err);
      }

      this.return$.next(parsed);
    } finally {
      localStorage.removeItem(MAYA_DEEP_LINK_STORAGE_KEY);
      sessionStorage.removeItem(MAYA_DEEP_LINK_STORAGE_KEY);
      this.processingReturn = false;
    }
  }

  async processStoredReturn(): Promise<void> {
    const url = localStorage.getItem(MAYA_DEEP_LINK_STORAGE_KEY);
    if (!url) {
      return;
    }
    const parsed = this.parseReturnUrl(url);
    if (parsed) {
      await this.processReturn(parsed);
    }
    localStorage.removeItem(MAYA_DEEP_LINK_STORAGE_KEY);
    sessionStorage.removeItem(MAYA_DEEP_LINK_STORAGE_KEY);
  }

  savePendingCheckout(snapshot: MayaPendingSnapshot): void {
    localStorage.setItem(MAYA_PENDING_STORAGE_KEY, JSON.stringify(snapshot));
    sessionStorage.setItem('maya_pending_payment', JSON.stringify(snapshot));
  }

  peekPendingCheckout(): MayaPendingSnapshot | null {
    const raw =
      localStorage.getItem(MAYA_PENDING_STORAGE_KEY) ||
      sessionStorage.getItem('maya_pending_payment');
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as MayaPendingSnapshot;
    } catch {
      return null;
    }
  }

  consumePendingCheckout(): MayaPendingSnapshot | null {
    const snap = this.peekPendingCheckout();
    localStorage.removeItem(MAYA_PENDING_STORAGE_KEY);
    sessionStorage.removeItem('maya_pending_payment');
    return snap;
  }

  consumeSuccessUi(): MayaSuccessUi | null {
    const raw = localStorage.getItem(MAYA_SUCCESS_UI_KEY);
    if (raw) {
      localStorage.removeItem(MAYA_SUCCESS_UI_KEY);
    }
    if (!raw) {
      return null;
    }
    try {
      return JSON.parse(raw) as MayaSuccessUi;
    } catch {
      return null;
    }
  }

  consumePendingReturn(): string | null {
    const url =
      localStorage.getItem(MAYA_DEEP_LINK_STORAGE_KEY) ||
      sessionStorage.getItem(MAYA_DEEP_LINK_STORAGE_KEY);
    localStorage.removeItem(MAYA_DEEP_LINK_STORAGE_KEY);
    sessionStorage.removeItem(MAYA_DEEP_LINK_STORAGE_KEY);
    return url;
  }

  parseReturnUrl(url: string): MayaReturnParams | null {
    const qIdx = url.indexOf('?');
    if (qIdx < 0) {
      return null;
    }
    const params = new URLSearchParams(url.slice(qIdx + 1));
    const status = params.get('maya_status');
    if (!status) {
      return null;
    }
    return {
      status,
      ticketId: params.get('maya_ticket') || '',
    };
  }
}
