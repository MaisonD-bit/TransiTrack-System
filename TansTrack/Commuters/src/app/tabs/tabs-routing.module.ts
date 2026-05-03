import { NgModule } from '@angular/core';
import { RouterModule, Routes } from '@angular/router';
import { TabsPage } from './tabs.page';

const routes: Routes = [
  {
    path: '',
    component: TabsPage,
    children: [
      {
        path: 'home',
        loadChildren: () => import('../home/home.module').then(m => m.HomePageModule)
      },
      {
        path: 'trip-history',
        loadChildren: () => import('../trip-history/trip-history.module').then(m => m.TripHistoryModule)
      },
      {
        path: 'feedback',
        loadChildren: () => import('../feedback/feedback.module').then(m => m.FeedbackModule)
      },
      {
        path: 'customer-support',
        loadChildren: () => import('../customer-support/customer-support.module').then(m => m.CustomerSupportModule)
      },
      {
        path: 'profile',
        loadChildren: () => import('../profile/profile.module').then(m => m.ProfilePageModule)
      },
      {
        path: '',
        redirectTo: 'home',
        pathMatch: 'full'
      }
    ]
  }
];

@NgModule({
  imports: [RouterModule.forChild(routes)],
  exports: [RouterModule]
})
export class TabsRoutingModule { }
