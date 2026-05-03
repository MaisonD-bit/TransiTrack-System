import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { JobMiniMapComponent } from './job-mini-map.component';

@NgModule({
  declarations: [JobMiniMapComponent],
  imports: [
    CommonModule,
    IonicModule
  ],
  exports: [JobMiniMapComponent]
})
export class JobMiniMapModule { }
