import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { environment } from '../../environments/environment';

@Injectable({
  providedIn: 'root'
})
export class CustomerSupportService {
  private apiUrl = environment.apiUrl;

  constructor(private http: HttpClient) { }

  private getHeaders(): HttpHeaders {
    return new HttpHeaders({
      'ngrok-skip-browser-warning': 'true'
    });
  }

  // Support Tickets
  getUserTickets(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/support/tickets`,
      { headers: this.getHeaders() }
    );
  }

  getTicketDetails(ticketId: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/support/tickets/${ticketId}`,
      { headers: this.getHeaders() }
    );
  }

  createTicket(ticketData: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/support/tickets/create`,
      ticketData,
      { headers: this.getHeaders() }
    );
  }

  updateTicket(ticketId: string, ticketData: any): Observable<any> {
    return this.http.put<any>(
      `${this.apiUrl}/support/tickets/${ticketId}`,
      ticketData,
      { headers: this.getHeaders() }
    );
  }

  closeTicket(ticketId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/support/tickets/${ticketId}/close`,
      {},
      { headers: this.getHeaders() }
    );
  }

  deleteTicket(ticketId: string): Observable<any> {
    return this.http.delete<any>(
      `${this.apiUrl}/support/tickets/${ticketId}`,
      { headers: this.getHeaders() }
    );
  }

  // Ticket Responses
  addTicketResponse(ticketId: string, responseData: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/support/tickets/${ticketId}/responses`,
      responseData,
      { headers: this.getHeaders() }
    );
  }

  // FAQ
  getFAQs(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/support/faq`,
      { headers: this.getHeaders() }
    );
  }

  getFAQByCategory(category: string): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/support/faq/category/${category}`,
      { headers: this.getHeaders() }
    );
  }

  markFAQHelpful(faqId: string): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/support/faq/${faqId}/helpful`,
      {},
      { headers: this.getHeaders() }
    );
  }

  // Contact Form
  sendContactMessage(messageData: any): Observable<any> {
    return this.http.post<any>(
      `${this.apiUrl}/support/contact`,
      messageData,
      { headers: this.getHeaders() }
    );
  }

  // Support Categories
  getSupportCategories(): Observable<any> {
    return this.http.get<any>(
      `${this.apiUrl}/support/categories`,
      { headers: this.getHeaders() }
    );
  }

  // Local storage fallbacks
  saveLocalTicket(ticket: any): void {
    const tickets = this.getLocalTicketsSync();
    tickets.unshift(ticket);
    localStorage.setItem('localSupportTickets', JSON.stringify(tickets));
  }

  getLocalTicketsSync(): any[] {
    try {
      const stored = localStorage.getItem('localSupportTickets');
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  }

  getLocalTickets(): Observable<any> {
    return of({ success: true, data: this.getLocalTicketsSync() });
  }

  getDefaultFAQs(): any[] {
    return [
      { id: 'faq-1', question: 'How do I generate an e-Ticket?', answer: 'Select a route from the Home tab, then tap "Get e-Ticket". Your ticket will show fare details and payment options.', category: 'tickets', helpful: 0 },
      { id: 'faq-2', question: 'What payment methods are accepted?', answer: 'Cash (pay the conductor directly), PayMaya, or GCash. Select your method inside the e-Ticket before boarding.', category: 'payment', helpful: 0 },
      { id: 'faq-3', question: 'How does the 20% discount work?', answer: 'A 20% discount is automatically applied when your passenger type is set to PWD, Senior, or Student in your profile.', category: 'fares', helpful: 0 },
      { id: 'faq-4', question: 'How do I verify my ID for a discount?', answer: 'Go to your Profile tab, set your passenger type, then tap the ID scanner button to verify your ID.', category: 'account', helpful: 0 },
      { id: 'faq-5', question: 'How do I check my trip history?', answer: 'Switch to the Trips tab to view all your past journeys. Trips are saved automatically when you close a ticket.', category: 'general', helpful: 0 },
      { id: 'faq-6', question: 'Can I use the app without internet?', answer: 'Trip history and support tickets are stored on your device. Live route tracking and fare calculation require internet.', category: 'general', helpful: 0 }
    ];
  }
}
