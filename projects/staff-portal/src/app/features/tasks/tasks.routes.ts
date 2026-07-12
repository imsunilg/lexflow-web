import { Routes } from '@angular/router';

/** PRD §13 nav: "Tasks (Board | Workload | Templates)". */
export const TASKS_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'board' },
  {
    path: 'board',
    loadComponent: () => import('./board/kanban-board.page').then((m) => m.KanbanBoardPage),
  },
  {
    path: 'workload',
    loadComponent: () => import('./workload/workload-board.page').then((m) => m.WorkloadBoardPage),
    data: { permission: 'tasks.read.team' },
  },
  {
    path: 'templates',
    loadComponent: () =>
      import('./templates/template-manager.page').then((m) => m.TemplateManagerPage),
    data: { permission: 'tasks.templates.manage' },
  },
];
