/** Lean projection of `GET /users` (`UserDto`, PRD Module 14) — used by other modules for owner/assignee pickers ahead of the full User Management build-out. */
export interface UserSummary {
  id: string;
  email: string;
  name: string;
  status: string;
}
