import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { IonicModule } from '@ionic/angular';
import { RouterModule, Routes } from '@angular/router';
import { PerformancePage } from './performance.page';

const routes: Routes = [{ path: '', component: PerformancePage }];

@NgModule({
  imports: [CommonModule, IonicModule, RouterModule.forChild(routes)],
  declarations: [PerformancePage],
})
export class PerformancePageModule {}
