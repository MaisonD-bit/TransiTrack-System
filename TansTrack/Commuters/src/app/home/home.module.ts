import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { HomePage } from './home.page';
import { RouteMapComponent } from '../components/route-map/route-map.component';

import { HomePageRoutingModule } from './home-routing.module';
import { ETicketComponent} from '../components/e-ticket/e-ticket.component'

@NgModule({
  imports: [
    CommonModule,
    FormsModule,
    IonicModule,
    HttpClientModule,
    HomePageRoutingModule,
    RouteMapComponent,
    ETicketComponent
  ],
  declarations: [HomePage]
})
export class HomePageModule {}