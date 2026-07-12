import { Routes } from '@angular/router';

/** PRD Module 16 UI Components — AI Studio hub, Contract Review, Draft Studio, Research. */
export const AI_ROUTES: Routes = [
  { path: '', loadComponent: () => import('./ai-hub.page').then((m) => m.AiHubPage) },
  {
    path: 'contract-review',
    loadComponent: () =>
      import('./contract-review/contract-review.page').then((m) => m.ContractReviewPage),
  },
  {
    path: 'draft-studio',
    loadComponent: () => import('./draft-studio/draft-studio.page').then((m) => m.DraftStudioPage),
  },
  {
    path: 'research',
    loadComponent: () => import('./research/research.page').then((m) => m.ResearchPage),
  },
];
