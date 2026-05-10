import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { FeedbackRoutingModule } from './feedback-routing.module';
import { FeedbackPage } from './feedback.page';

@NgModule({
  imports: [
    CommonModule,
    IonicModule,
    FormsModule,
    FeedbackRoutingModule
  ],
  declarations: [FeedbackPage]
})
export class FeedbackModule { }
