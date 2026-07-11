export type CountdownTone = 'green' | 'amber' | 'red';

export interface HearingCountdown {
  tone: CountdownTone;
  label: string;
}

/**
 * "Countdown color shift (green→amber→red) on hearing chips" (PRD §12
 * Micro-interactions) — the PRD names the transition but gives no numeric
 * day/hour thresholds anywhere in the document. This implementation's own
 * choice: green when the next hearing is more than 7 days out, amber within
 * 7 days, red within 24 hours or already overdue (a hearing date in the past
 * with no outcome yet recorded).
 */
export function hearingCountdown(hearingDateIso: string | null): HearingCountdown | null {
  if (!hearingDateIso) {
    return null;
  }

  const now = new Date();
  const hearingDate = new Date(hearingDateIso);
  const diffMs = hearingDate.getTime() - now.getTime();
  const diffHours = diffMs / (1000 * 60 * 60);
  const diffDays = diffHours / 24;

  const tone: CountdownTone = diffHours < 24 ? 'red' : diffDays <= 7 ? 'amber' : 'green';

  return { tone, label: formatCountdownLabel(diffMs) };
}

function formatCountdownLabel(diffMs: number): string {
  const absHours = Math.abs(diffMs) / (1000 * 60 * 60);
  const absDays = Math.floor(absHours / 24);

  if (diffMs < 0) {
    return absDays >= 1 ? `${absDays}d overdue` : 'Overdue';
  }
  if (absDays >= 1) {
    return `${absDays}d`;
  }
  const hours = Math.max(1, Math.floor(absHours));
  return `${hours}h`;
}
