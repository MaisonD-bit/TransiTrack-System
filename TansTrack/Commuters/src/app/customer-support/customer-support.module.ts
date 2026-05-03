import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { CustomerSupportRoutingModule } from './customer-support-routing.module';
import { CustomerSupportPage } from './customer-support.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    CustomerSupportRoutingModule
  ],
  declarations: [CustomerSupportPage]
})
export class CustomerSupportModule { }
