import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MapPageRoutingModule } from './map-routing.module';
import { MapPage } from './map.page';
import { RouteMapComponent } from '../components/route-map/route-map.component';
import { DriverQrScannerComponent } from '../components/driver-qr-scanner/driver-qr-scanner.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MapPageRoutingModule,
    RouteMapComponent,
    DriverQrScannerComponent,
  ],
  declarations: [MapPage]
})
export class MapPageModule {}