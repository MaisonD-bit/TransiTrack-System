import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { PerformancePage } from './performance.page';

const routes: Routes = [{ path: '', component: PerformancePage }];

@NgModule({
  imports: [PerformancePage, RouterModule.forChild(routes)],
})
export class PerformancePageModule {}
