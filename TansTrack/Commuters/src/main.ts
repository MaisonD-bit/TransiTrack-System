import { platformBrowserDynamic } from '@angular/platform-browser-dynamic';
import { registerLocaleData } from '@angular/common';
import localeEn from '@angular/common/locales/en';
import { addIcons } from 'ionicons';
import {
  eyeOutline,
  eyeOffOutline,
  personAddOutline,
  busOutline,
  shareOutline,
  saveOutline,
  logOutOutline,
  navigateOutline,
  mapOutline,
  locationOutline,
  listOutline,
  pricetagOutline,
  speedometerOutline,
  checkmarkCircleOutline,
  ticketOutline,
  informationCircleOutline,
  personCircleOutline,
  mailOutline,
  lockClosedOutline,
  cashOutline,
  homeOutline,
  timeOutline,
  starOutline,
  helpCircleOutline,
  personOutline,
  closeCircleOutline,
  flagOutline,
  location,
  bus,
  flag,
  receiptOutline,
  checkmarkCircle,
  close,
  documentOutline,
  trashOutline,
  chevronForwardOutline,
} from 'ionicons/icons';

import { AppModule } from './app/app.module';

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
  location,
  bus,
  flag,
  'receipt-outline': receiptOutline,
  'checkmark-circle': checkmarkCircle,
  close,
  'document-outline': documentOutline,
  'trash-outline': trashOutline,
  'chevron-forward-outline': chevronForwardOutline,
});

function showBootstrapFailure(err: unknown): void {
  console.error(err);
  const text = err instanceof Error ? `${err.message}\n\n${err.stack ?? ''}` : String(err);
  const pre = document.createElement('pre');
  pre.setAttribute('data-transitrack', 'bootstrap-error');
  pre.style.cssText =
    'box-sizing:border-box;margin:0;padding:12px;width:100%;min-height:100vh;' +
    'white-space:pre-wrap;word-break:break-word;font:12px/1.4 system-ui,monospace;' +
    'color:#fff;background:#7f1d1d;';
  pre.textContent = `TransiTrack failed to start (Angular bootstrap).\n\n${text}`;
  document.body.appendChild(pre);
}

platformBrowserDynamic()
  .bootstrapModule(AppModule)
  .catch((err: unknown) => showBootstrapFailure(err));
