import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { HomePage } from './home.page';
import { RouteMapComponent } from '../components/route-map/route-map.component';
import { HomePageRoutingModule } from './home-routing.module';
import { ETicketComponent } from '../components/e-ticket/e-ticket.component';
import { QrScannerComponent } from '../components/qr-scanner/qr-scanner.component';
import { CardPaymentComponent } from '../components/card-payment/card-payment.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HomePageRoutingModule,
    RouteMapComponent,
    ETicketComponent,
    QrScannerComponent,
    CardPaymentComponent,
  ],
  declarations: [HomePage],
})
export class HomePageModule {}
