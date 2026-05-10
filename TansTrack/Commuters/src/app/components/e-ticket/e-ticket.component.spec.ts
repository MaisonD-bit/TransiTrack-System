import { ComponentFixture, TestBed, waitForAsync } from '@angular/core/testing';

import { ETicketComponent } from './e-ticket.component';

describe('ETicketComponent', () => {
  let component: ETicketComponent;
  let fixture: ComponentFixture<ETicketComponent>;

  beforeEach(waitForAsync(() => {
    TestBed.configureTestingModule({
      imports: [ETicketComponent],
    }).compileComponents();

    fixture = TestBed.createComponent(ETicketComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  }));

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
