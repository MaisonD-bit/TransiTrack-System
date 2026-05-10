import { HttpInterceptorFn } from '@angular/common/http';
import { environment } from '../../environments/environment';

/**
 * ngrok-free.app returns an interstitial HTML page (no CORS headers) unless this header is sent.
 * Required for browser preflight + fetch from Ionic dev server (e.g. localhost:8101).
 */
export const ngrokSkipWarningInterceptor: HttpInterceptorFn = (req, next) => {
  const url = environment.apiUrl || '';
  if (!url.includes('ngrok')) {
    return next(req);
  }
  const nextReq = req.clone({
    setHeaders: {
      'ngrok-skip-browser-warning': 'true',
      Accept: req.headers.get('Accept') || 'application/json',
    },
  });
  return next(nextReq);
};
