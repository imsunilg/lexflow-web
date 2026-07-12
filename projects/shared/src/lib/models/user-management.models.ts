/**
 * Module 14 — User Management. Backend confirmed real and mostly comprehensive
 * (`UsersController`, `RolesController`, `TeamsController`, `DepartmentsController`,
 * `BranchesController`, `SessionsController`, `LoginHistoryController`,
 * `PermissionsController`) — documented gaps below are real backend limitations,
 * not oversights in this frontend:
 *
 * - No photo/signature-image upload endpoint exists at all — the `User` entity
 *   has the blob-path columns, but nothing reads or writes them via the API.
 *   Not built here; there is nothing to call.
 * - No "working hours" field exists anywhere (entity, DTO, or command) — not
 *   modeled, not built.
 * - `notificationPrefsJson` is write-only: `PUT` accepts it but `GET`/`UserDetail`
 *   never returns it, so a "current notification prefs" form can't be
 *   pre-filled — the edit form is presented as "set new preferences", not
 *   "edit existing ones".
 * - `costRate` has no visibility restriction server-side despite the PRD
 *   calling for "restricted visibility" — anyone with `users.read.all` sees it
 *   today. Not hidden client-side either, since a client-side hide is not real
 *   security and would misrepresent what's actually protected.
 * - The deactivation wizard's reassignment step only resolves `team_lead`
 *   entries — `GET /users/{id}/unresolved-assignments` never returns
 *   Matter/Task/Lead rows because nothing publishes them yet. The wizard only
 *   shows what the backend can actually resolve.
 * - No role DELETE endpoint — the role manager has no delete action.
 * - Departments have a single `headUserId`, no reporting-manager chain/parent
 *   department — the department form reflects a flat structure, not an org
 *   chart.
 * - Branches have no holiday-calendar sub-resource — Module 15 §13 "business
 *   hours & holidays" covers holidays at the settings-blob level instead.
 * - IP allow-list per role (Enterprise) has zero backend support (no entity,
 *   no field, no middleware) — not built.
 * - `GET /users/{id}/effective-permissions?resource=` accepts `resource` but
 *   the backend ignores it and always explains the user's full effective
 *   permission set — the inspector is framed as "why can this user do X"
 *   generally, not resource-scoped, to match actual behavior.
 * - `GET /login-history` has no geo field — IP/UA/outcome only.
 */

export const USER_STATUSES = ['Invited', 'Active', 'Suspended', 'Deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export interface UserDetail {
  id: string;
  email: string;
  name: string;
  designation: string | null;
  barEnrollmentNo: string | null;
  phone: string | null;
  costRate: number | null;
  branchId: string | null;
  departmentId: string | null;
  status: UserStatus;
  tz: string | null;
  locale: string | null;
  twoFaEnabled: boolean;
}

export interface InviteUserRequest {
  email: string;
  name: string;
  roleId: string;
  branchId?: string | null;
  departmentId?: string | null;
}

export interface UpdateUserRequest {
  name: string;
  designation?: string | null;
  barEnrollmentNo?: string | null;
  phone?: string | null;
  costRate?: number | null;
  branchId?: string | null;
  departmentId?: string | null;
  tz?: string | null;
  locale?: string | null;
  notificationPrefsJson?: string;
}

export interface ReassignmentEntry {
  entityType: string;
  entityId: string;
  newAssigneeUserId: string;
}

export interface DeactivateUserRequest {
  reassignments: ReassignmentEntry[];
}

export interface UnresolvedAssignment {
  entityType: string;
  entityId: string;
  description: string;
}

export interface SessionInfo {
  id: string;
  userId: string;
  ua: string | null;
  ip: string | null;
  expiresAt: string;
  revokedAt: string | null;
  isActive: boolean;
}

export interface LoginHistoryEntry {
  id: string;
  userId: string | null;
  at: string;
  ip: string | null;
  ua: string | null;
  result: string;
  failureReason: string | null;
}

export interface RoleDto {
  id: string;
  key: string;
  name: string;
  isSystem: boolean;
  permissionIds: string[];
}

export interface CreateRoleRequest {
  key: string;
  name: string;
  permissionIds: string[];
}

export interface UpdateRoleRequest {
  name: string;
  permissionIds: string[];
}

export type GrantSourceType = 'role' | 'direct_grant';

export interface GrantSource {
  sourceType: GrantSourceType;
  sourceId: string;
  sourceName: string;
}

export interface EffectivePermissionExplanation {
  key: string;
  module: string;
  action: string;
  scope: string;
  sources: GrantSource[];
}

export interface TeamDto {
  id: string;
  name: string;
  leadUserId: string | null;
  memberUserIds: string[];
}

export interface UpsertTeamRequest {
  name: string;
  leadUserId?: string | null;
  memberUserIds: string[];
}

export interface DepartmentDto {
  id: string;
  name: string;
  code: string | null;
  headUserId: string | null;
}

export interface UpsertDepartmentRequest {
  name: string;
  code?: string | null;
  headUserId?: string | null;
}

export interface BranchDto {
  id: string;
  name: string;
  code: string;
  addressJson: string | null;
  tz: string;
  gstin: string | null;
  seriesPrefix: string | null;
}

export interface UpsertBranchRequest {
  name: string;
  code: string;
  addressJson?: string | null;
  tz: string;
  gstin?: string | null;
  seriesPrefix?: string | null;
}
