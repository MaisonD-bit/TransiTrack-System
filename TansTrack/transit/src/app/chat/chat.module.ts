import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { FormsModule } from '@angular/forms';
import { ChatPageRoutingModule } from './chat-routing.module';
import { ChatPage } from './chat.page';

@NgModule({
  imports: [CommonModule, IonicModule, FormsModule, ChatPageRoutingModule],
  declarations: [ChatPage]
})
export class ChatPageModule {}
