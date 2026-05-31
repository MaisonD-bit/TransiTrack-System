import { Component, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { StreamChat, Channel, type LocalMessage, type MessageResponse } from 'stream-chat';
import { environment } from '../../environments/environment';
import { ApiService } from '../services/api.service';
import { AuthService } from '../services/auth.service';
import { ToastController } from '@ionic/angular';

@Component({
  selector: 'app-chat',
  templateUrl: './chat.page.html',
  styleUrls: ['./chat.page.scss'],
  standalone: false
})
export class ChatPage implements OnInit, OnDestroy {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  messages: any[] = [];
  newMessage = '';
  isConnected = false;
  isLoading = true;
  operatorName = 'Operator';
  error = '';

  private client: StreamChat | null = null;
  private channel: Channel | null = null;

  constructor(
    private apiService: ApiService,
    private authService: AuthService,
    private toastController: ToastController
  ) {}

  async ngOnInit() {
    await this.initChat();
  }

  async ngOnDestroy() {
    if (this.client) {
      await this.client.disconnectUser();
    }
  }

  async initChat() {
    this.isLoading = true;
    this.error = '';

    const driverId = Number(this.authService.getDriverId());
    if (!driverId) {
      this.error = 'Not logged in as a driver.';
      this.isLoading = false;
      return;
    }

    try {
      const tokenData: any = await this.apiService.getDriverStreamToken(driverId).toPromise();
      if (!tokenData?.success) {
        this.error = tokenData?.message || 'Could not connect to chat.';
        this.isLoading = false;
        return;
      }

      this.operatorName = tokenData.operator_name;

      this.client = StreamChat.getInstance(environment.messaging.streamApiKey);

      await this.client.connectUser(
        { id: tokenData.user_id, name: tokenData.user_name },
        tokenData.token
      );

      // Create or get the direct channel between driver and operator
      const channelId = `driver${driverId}-op${tokenData.operator_id}`;
      this.channel = this.client.channel('messaging', channelId, {
        members: [tokenData.user_id, tokenData.operator_id],
        name: tokenData.user_name,
      } as any);

      await this.channel.watch();

      const channelData = this.channel.data as { name?: string } | undefined;
      if (!(channelData?.name || '').trim()) {
        await this.channel.update({ name: tokenData.user_name } as Record<string, string>);
      }

      // Load existing messages
      this.messages = (this.channel.state.messages || []).map((m: LocalMessage) => this.formatMsg(m));

      // Listen for new messages
      this.channel.on('message.new', (event: any) => {
        if (event.message && !this.messages.find(m => m.id === event.message.id)) {
          this.messages = [...this.messages, this.formatMsg(event.message)];
          setTimeout(() => this.scrollToBottom(), 100);
        }
      });

      this.isConnected = true;
      this.isLoading = false;
      setTimeout(() => this.scrollToBottom(), 200);

    } catch (e: any) {
      this.error = e?.message || 'Failed to connect to chat.';
      this.isLoading = false;
    }
  }

  async sendMessage() {
    const text = this.newMessage.trim();
    if (!text || !this.channel) return;

    this.newMessage = '';
    try {
      await this.channel.sendMessage({ text });
    } catch {
      const toast = await this.toastController.create({
        message: 'Failed to send message.',
        duration: 2000,
        color: 'danger',
        position: 'bottom'
      });
      await toast.present();
    }
  }

  private formatMsg(m: LocalMessage | MessageResponse) {
    return {
      id: m.id,
      text: m.text,
      createdAt: m.created_at,
      userId: m.user?.id,
      userName: m.user?.name || 'Unknown',
      isMine: m.user?.id === this.client?.userID,
    };
  }

  private scrollToBottom() {
    try {
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch {}
  }

  formatTime(dateStr: string): string {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleTimeString('en-PH', { hour: '2-digit', minute: '2-digit', hour12: true });
  }
}
