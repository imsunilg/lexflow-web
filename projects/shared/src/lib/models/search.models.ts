/**
 * `GET /search?q=` result shape (PRD §26: federated search across Leads, Clients,
 * Matters, Cases, Documents, Tasks, Invoices, KB — grouped by type, top-3 per group).
 * This endpoint is not implemented server-side yet (Build Playbook Prompt D-1: "a
 * stub calling GET /search") — the overlay is built fully against this documented
 * contract and degrades to its empty state until the backend ships it.
 */
export interface SearchResultItem {
  type: string;
  id: string;
  title: string;
  subtitle: string | null;
  url: string;
}

export interface SearchResultGroup {
  type: string;
  label: string;
  items: SearchResultItem[];
}
