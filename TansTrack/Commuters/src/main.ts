import { bootstrapApplication } from '@angular/platform-browser';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { ngrokSkipWarningInterceptor } from './app/interceptors/ngrok-skip-warning.interceptor';
import { AppComponent } from './app/app.component';
import { provideIonicAngular } from '@ionic/angular/standalone';
import { provideRouter } from '@angular/router';
import { routes } from './app/app.routes';
import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import { addIcons } from 'ionicons';
import {
  eyeOutline, eyeOffOutline, personAddOutline, busOutline, shareOutline,
  saveOutline, logOutOutline,
  navigateOutline, mapOutline, locationOutline, listOutline,
  pricetagOutline, speedometerOutline, checkmarkCircleOutline,
  ticketOutline, informationCircleOutline, personCircleOutline,
  mailOutline, lockClosedOutline, cashOutline,
  homeOutline, timeOutline, starOutline, helpCircleOutline, personOutline,
  closeCircleOutline, flagOutline, location, bus, flag
} from 'ionicons/icons';

registerLocaleData(localeEn);

addIcons({
  'eye-outline': eyeOutline,
  'eye-off-outline': eyeOffOutline,
  'person-add-outline': personAddOutline,
  'bus-outline': busOutline,
  'share-outline': shareOutline,
  'save-outline': saveOutline,
  'log-out-outline': logOutOutline,
  'navigate-outline': navigateOutline,
  'map-outline': mapOutline,
  'location-outline': locationOutline,
  'list-outline': listOutline,
  'pricetag-outline': pricetagOutline,
  'speedometer-outline': speedometerOutline,
  'checkmark-circle-outline': checkmarkCircleOutline,
  'ticket-outline': ticketOutline,
  'information-circle-outline': informationCircleOutline,
  'person-circle-outline': personCircleOutline,
  'mail-outline': mailOutline,
  'lock-closed-outline': lockClosedOutline,
  'cash-outline': cashOutline,
  'home-outline': homeOutline,
  'time-outline': timeOutline,
  'star-outline': starOutline,
  'help-circle-outline': helpCircleOutline,
  'person-outline': personOutline,
  'close-circle-outline': closeCircleOutline,
  'flag-outline': flagOutline,
  'location': location,
  'bus': bus,
  'flag': flag
});

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideIonicAngular(),
    provideHttpClient(
      withFetch(),
      withInterceptors([ngrokSkipWarningInterceptor])
    )
  ]
}).catch(err => console.error(err));
