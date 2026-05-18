import { NgModule } from '@angular/core';
import { BrowserModule } from '@angular/platform-browser';
import { RouteReuseStrategy } from '@angular/router';
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { IonicModule, IonicRouteStrategy } from '@ionic/angular';

import { AppComponent } from './app.component';
import { AppRoutingModule } from './app-routing.module';
import { ngrokSkipWarningInterceptor } from './interceptors/ngrok-skip-warning.interceptor';

/**
 * NgModule bootstrap with IonicModule.forRoot() — required for Capacitor Android.
 * Do not mix this with bootstrapApplication + provideIonicAngular (breaks lazy tab pages).
 */
@NgModule({
  declarations: [AppComponent],
  imports: [BrowserModule, IonicModule.forRoot({ animated: false }), AppRoutingModule],
  providers: [
    { provide: RouteReuseStrategy, useClass: IonicRouteStrategy },
    provideHttpClient(withInterceptors([ngrokSkipWarningInterceptor])),
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
