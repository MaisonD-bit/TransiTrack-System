import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular'; 
import { FormsModule } from '@angular/forms'; 
import { NotificationsPageRoutingModule } from './notifications-routing.module';
import { NotificationsPage } from './notifications.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule, 
    FormsModule,
    NotificationsPageRoutingModule
  ],
  declarations: [NotificationsPage] 
})
export class NotificationsPageModule {}