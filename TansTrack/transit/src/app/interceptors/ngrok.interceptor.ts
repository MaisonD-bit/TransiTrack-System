import { Injectable } from '@angular/core';
import { HttpInterceptor, HttpRequest, HttpHandler, HttpEvent } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable()
export class NgrokInterceptor implements HttpInterceptor {
  intercept(req: HttpRequest<any>, next: HttpHandler): Observable<HttpEvent<any>> {
    if ((environment.apiUrl || '').includes('ngrok')) {
      const modified = req.clone({
        setHeaders: {
          'ngrok-skip-browser-warning': 'true',
          'Accept': req.headers.get('Accept') || 'application/json'
        }
      });
      return next.handle(modified);
    }
    return next.handle(req);
  }
}
