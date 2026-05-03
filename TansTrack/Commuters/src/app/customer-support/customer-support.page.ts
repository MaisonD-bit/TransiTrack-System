import { Component, OnInit, OnDestroy } from '@angular/core';
import { CustomerSupportService } from '../services/customer-support.service';
import { Subscription } from 'rxjs';
import { ToastController, LoadingController, ViewWillEnter } from '@ionic/angular';

export interface SupportTicket {
  id: string;
  subject: string;
  description: string;
  category: string;
  priority: string; // 'low', 'medium', 'high', 'urgent'
  status: string; // 'open', 'in-progress', 'resolved', 'closed'
  createdDate: string;
  lastUpdated: string;
  responses: SupportResponse[];
  attachments?: string[];
}

export interface SupportResponse {
  id: string;
  sender: string; // 'user' or 'support'
  message: string;
  timestamp: string;
  attachments?: string[];
}

export interface FAQItem {
  id: string;
  question: string;
  answer: string;
  category: string;
  helpful: number;
}

@Component({
  selector: 'app-customer-support',
  templateUrl: './customer-support.page.html',
  styleUrls: ['./customer-support.page.scss'],
  standalone: false,
})
export class CustomerSupportPage implements OnInit, OnDestroy, ViewWillEnter {
  // UI State
  activeTab: string = 'support'; // 'support', 'faq', 'contact'
  
  // Support Tickets
  tickets: SupportTicket[] = [];
  displayedTickets: SupportTicket[] = [];
  selectedTicket: SupportTicket | null = null;
  showTicketDetail: boolean = false;
  showNewTicketForm: boolean = false;
  isLoadingTickets: boolean = false;
  
  // FAQ
  faqs: FAQItem[] = [];
  searchFAQ: string = '';
  expandedFAQIds: Set<string> = new Set();
  
  // Contact Information
  showContactForm: boolean = false;
  contactQuery = {
    name: '',
    email: '',
    subject: '',
    message: ''
  };
  
  // New Ticket Form
  newTicket = {
    subject: '',
    description: '',
    category: 'general',
    priority: 'medium',
    attachments: []
  };
  
  categories = [
    { value: 'general', label: 'General Inquiry' },
    { value: 'billing', label: 'Billing Issue' },
    { value: 'technical', label: 'Technical Issue' },
    { value: 'complaint', label: 'Complaint' },
    { value: 'suggestion', label: 'Suggestion' },
    { value: 'refund', label: 'Refund Request' }
  ];
  
  priorities = [
    { value: 'low', label: 'Low' },
    { value: 'medium', label: 'Medium' },
    { value: 'high', label: 'High' },
    { value: 'urgent', label: 'Urgent' }
  ];
  
  ticketFilter: string = 'all';
  isSubmitting: boolean = false;
  
  private subscriptions: Subscription[] = [];

  constructor(
    private supportService: CustomerSupportService,
    private toastController: ToastController,
    private loadingController: LoadingController
  ) {}

  ngOnInit() {
    this.loadFAQs();
  }

  ionViewWillEnter() {
    this.loadTickets();
  }

  ngOnDestroy() {
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  async loadTickets() {
    this.isLoadingTickets = true;
    const loading = await this.loadingController.create({
      message: 'Loading tickets...'
    });
    await loading.present();

    const sub = this.supportService.getUserTickets().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.tickets = response.data;
        }
        const localTickets = this.supportService.getLocalTicketsSync();
        const existingIds = new Set(this.tickets.map((t: SupportTicket) => t.id));
        localTickets.forEach((t: any) => { if (!existingIds.has(t.id)) this.tickets.push(t); });
        this.applyTicketFilter();
        this.isLoadingTickets = false;
        loading.dismiss();
      },
      error: () => {
        this.tickets = this.supportService.getLocalTicketsSync();
        this.applyTicketFilter();
        this.isLoadingTickets = false;
        loading.dismiss();
      }
    });

    this.subscriptions.push(sub);
  }

  loadFAQs() {
    const sub = this.supportService.getFAQs().subscribe({
      next: (response: any) => {
        if (response.success && response.data) {
          this.faqs = response.data;
        } else {
          this.faqs = this.supportService.getDefaultFAQs();
        }
      },
      error: () => {
        this.faqs = this.supportService.getDefaultFAQs();
      }
    });

    this.subscriptions.push(sub);
  }

  applyTicketFilter() {
    if (this.ticketFilter === 'all') {
      this.displayedTickets = this.tickets;
    } else {
      this.displayedTickets = this.tickets.filter(t => t.status === this.ticketFilter);
    }
    // Sort by most recent first
    this.displayedTickets.sort((a, b) => new Date(b.lastUpdated).getTime() - new Date(a.lastUpdated).getTime());
  }

  onTicketFilterChange() {
    this.applyTicketFilter();
  }

  // Ticket Management
  openNewTicketForm() {
    this.showNewTicketForm = true;
    this.newTicket = {
      subject: '',
      description: '',
      category: 'general',
      priority: 'medium',
      attachments: []
    };
  }

  closeNewTicketForm() {
    this.showNewTicketForm = false;
  }

  async submitNewTicket() {
    if (!this.newTicket.subject || !this.newTicket.description) {
      this.showToast('Please fill in all required fields', 'warning');
      return;
    }

    this.isSubmitting = true;
    const now = new Date().toISOString();
    const ticket: SupportTicket = {
      id: 'TKT-' + Date.now().toString(36).toUpperCase(),
      subject: this.newTicket.subject,
      description: this.newTicket.description,
      category: this.newTicket.category,
      priority: this.newTicket.priority,
      status: 'open',
      createdDate: now,
      lastUpdated: now,
      responses: []
    };

    this.supportService.saveLocalTicket(ticket);
    this.showToast('Support ticket created successfully!', 'success');
    this.closeNewTicketForm();
    this.loadTickets();
    this.isSubmitting = false;
  }

  selectTicket(ticket: SupportTicket) {
    this.selectedTicket = ticket;
    this.showTicketDetail = true;
  }

  closeTicketDetail() {
    this.showTicketDetail = false;
    this.selectedTicket = null;
  }

  // FAQ Management
  toggleFAQ(faqId: string) {
    if (this.expandedFAQIds.has(faqId)) {
      this.expandedFAQIds.delete(faqId);
    } else {
      this.expandedFAQIds.add(faqId);
    }
  }

  isFAQExpanded(faqId: string): boolean {
    return this.expandedFAQIds.has(faqId);
  }

  getFilteredFAQs(): FAQItem[] {
    if (!this.searchFAQ) {
      return this.faqs;
    }
    const query = this.searchFAQ.toLowerCase();
    return this.faqs.filter(faq => 
      faq.question.toLowerCase().includes(query) ||
      faq.answer.toLowerCase().includes(query)
    );
  }

  markFAQHelpful(faqId: string) {
    const sub = this.supportService.markFAQHelpful(faqId).subscribe({
      next: (response: any) => {
        if (response.success) {
          const faq = this.faqs.find(f => f.id === faqId);
          if (faq) {
            faq.helpful++;
          }
          this.showToast('Thank you for your feedback!', 'success');
        }
      },
      error: (error: any) => {
        console.error('Error marking FAQ helpful:', error);
      }
    });

    this.subscriptions.push(sub);
  }

  // Contact Form
  openContactForm() {
    this.showContactForm = true;
    this.contactQuery = {
      name: '',
      email: '',
      subject: '',
      message: ''
    };
  }

  closeContactForm() {
    this.showContactForm = false;
  }

  async submitContactForm() {
    if (!this.contactQuery.name || !this.contactQuery.email || !this.contactQuery.subject || !this.contactQuery.message) {
      this.showToast('Please fill in all fields', 'warning');
      return;
    }

    this.isSubmitting = true;
    const loading = await this.loadingController.create({
      message: 'Sending message...'
    });
    await loading.present();

    const sub = this.supportService.sendContactMessage(this.contactQuery).subscribe({
      next: (response: any) => {
        if (response.success) {
          this.showToast('Message sent successfully!', 'success');
          this.closeContactForm();
        }
        this.isSubmitting = false;
        loading.dismiss();
      },
      error: (error: any) => {
        console.error('Error sending message:', error);
        this.showToast('Failed to send message', 'danger');
        this.isSubmitting = false;
        loading.dismiss();
      }
    });

    this.subscriptions.push(sub);
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'open':
        return 'primary';
      case 'in-progress':
        return 'warning';
      case 'resolved':
        return 'success';
      case 'closed':
        return 'medium';
      default:
        return 'medium';
    }
  }

  getPriorityColor(priority: string): string {
    switch (priority) {
      case 'urgent':
        return 'danger';
      case 'high':
        return 'warning';
      case 'medium':
        return 'info';
      case 'low':
        return 'success';
      default:
        return 'medium';
    }
  }

  getRelativeTime(timestamp: string): string {
    const date = new Date(timestamp);
    const now = new Date();
    const seconds = (now.getTime() - date.getTime()) / 1000;

    if (seconds < 60) {
      return 'just now';
    } else if (seconds < 3600) {
      const minutes = Math.floor(seconds / 60);
      return `${minutes}m ago`;
    } else if (seconds < 86400) {
      const hours = Math.floor(seconds / 3600);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(seconds / 86400);
      return `${days}d ago`;
    }
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastController.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}
