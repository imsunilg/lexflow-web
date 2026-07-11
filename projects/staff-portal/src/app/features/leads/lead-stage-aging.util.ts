import { Lead } from 'shared';

export type LeadAgingTone = 'fresh' | 'warn' | 'stale';

export interface LeadAging {
  days: number;
  tone: LeadAgingTone;
}

/**
 * Stage-aging color-coding (PRD Module 2 UI Components: "Kanban board ...
 * stage-aging color" — no day-thresholds are given anywhere in the PRD, unlike
 * the hearing-chip countdown in §12, so these thresholds are this
 * implementation's own choice, loosely anchored to BR-11's 4-business-hour
 * first-contact SLA for "New" and widening for later stages: fresh (<2 days
 * since the lead's last update), warn (2–5 days), stale (>5 days).
 * `updatedAt` is used as a proxy for "time in current stage" since the API
 * doesn't expose a per-stage entered-at timestamp on `Lead` itself (only on
 * `LeadStageHistoryEntry`, which isn't loaded for the Kanban board).
 */
export function leadStageAging(lead: Lead): LeadAging {
  const reference = lead.updatedAt ?? lead.createdAt;
  const days = (Date.now() - new Date(reference).getTime()) / (1000 * 60 * 60 * 24);
  const tone: LeadAgingTone = days < 2 ? 'fresh' : days < 5 ? 'warn' : 'stale';
  return { days: Math.floor(days), tone };
}
