import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouteMapComponent } from './route-map.component';

@NgModule({
  declarations: [RouteMapComponent],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [RouteMapComponent]
})
export class RouteMapModule { }