import { Component, OnInit } from '@angular/core';
import { MayaReturnService } from './services/maya-return.service';

@Component({
  selector: 'app-root',
  templateUrl: 'app.component.html',
  styleUrls: ['app.component.scss'],
  standalone: false,
})
export class AppComponent implements OnInit {
  constructor(private readonly mayaReturn: MayaReturnService) {}

  ngOnInit(): void {
    this.mayaReturn.initDeepLinkListener();
  }
}
