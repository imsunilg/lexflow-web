/** Shape of `GET /auth/me`, PRD §17 `POST /auth/login` `user` object. */
export interface CurrentUser {
  id: string;
  name: string;
  role: string;
  permissions: string[];
  branchId: string;
}

/** Shape of `GET /permissions/catalog` — the full permission-key catalog (PRD §21). */
export interface PermissionCatalogEntry {
  key: string;
  module: string;
  action: string;
  scope: 'own' | 'team' | 'branch' | 'all' | 'special';
  label: string;
}
