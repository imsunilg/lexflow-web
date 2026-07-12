import { Routes } from '@angular/router';

/** PRD §13 nav: "Knowledge Base (Home | Articles | Collections)", plus drill-in Act/Judgment readers. */
export const KNOWLEDGE_BASE_ROUTES: Routes = [
  { path: '', pathMatch: 'full', redirectTo: 'home' },
  {
    path: 'home',
    loadComponent: () => import('./home/kb-home.page').then((m) => m.KbHomePage),
  },
  {
    path: 'articles',
    loadComponent: () => import('./articles/article-list.page').then((m) => m.ArticleListPage),
  },
  {
    path: 'articles/:id',
    loadComponent: () => import('./articles/article-editor.page').then((m) => m.ArticleEditorPage),
  },
  {
    path: 'collections',
    loadComponent: () =>
      import('./collections/collection-boards.page').then((m) => m.CollectionBoardsPage),
  },
  {
    path: 'acts/:id',
    loadComponent: () => import('./acts/act-reader.page').then((m) => m.ActReaderPage),
  },
  {
    path: 'judgments/:id',
    loadComponent: () =>
      import('./judgments/judgment-reader.page').then((m) => m.JudgmentReaderPage),
  },
];
