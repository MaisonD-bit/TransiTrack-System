import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { IonicModule } from '@ionic/angular';
import { MapPageRoutingModule } from './map-routing.module';
import { MapPage } from './map.page';
import { RouteMapComponent } from '../components/route-map/route-map.component';

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    MapPageRoutingModule,
    RouteMapComponent 
  ],
  declarations: [MapPage]
})
export class MapPageModule {}