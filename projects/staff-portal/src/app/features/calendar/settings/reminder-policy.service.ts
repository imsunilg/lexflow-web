import { Injectable, computed, signal } from '@angular/core';
import { ReminderPolicy, ReminderPolicyKind, ReminderRule } from './reminder-policy.models';

const STORAGE_KEY = 'lexflow.calendar.reminderPolicy';

function rule(
  offsetDays: number,
  fixedTime: string | null,
  channels: ReminderRule['channels'],
): ReminderRule {
  return { id: crypto.randomUUID(), offsetDays, fixedTime, channels };
}

/**
 * PRD Module 6 hearing default: "7d, 1d, same-day 07:00 court-local"
 * (User Flow §4). Other kinds start with a single sensible 1-day-before
 * email reminder; users can edit freely.
 */
function defaultPolicy(): ReminderPolicy {
  return {
    Hearing: [
      rule(7, null, ['Email']),
      rule(1, null, ['Email']),
      rule(0, '07:00', ['Email', 'SMS']),
    ],
    Deadline: [rule(1, null, ['Email'])],
    Task: [rule(0, null, ['InApp'])],
    Meeting: [rule(0, null, ['Email', 'InApp'])],
    Personal: [rule(0, null, ['InApp'])],
  };
}

function readFromStorage(): ReminderPolicy {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultPolicy();
    return JSON.parse(raw) as ReminderPolicy;
  } catch {
    return defaultPolicy();
  }
}

/**
 * Client-only staging area for per-type-kind reminder defaults (PRD Module 6
 * "reminder-policy editor"). Only `POST /calendar/events/{id}/reminders`
 * exists on the backend — a per-event override, already used by
 * `EventDialogComponent` — there is no endpoint for type-level defaults
 * (confirmed against `CalendarService`). These defaults are therefore
 * **not applied server-side today**; they are staged here (localStorage,
 * mirroring `SavedMatterViewsService`) pending a real policy API, so a
 * lawyer configuring "7d/1d/same-day" for Hearings sees it saved but must
 * still add explicit per-event reminders in the event dialog for them to
 * actually dispatch.
 */
@Injectable({ providedIn: 'root' })
export class ReminderPolicyService {
  private readonly policySignal = signal<ReminderPolicy>(readFromStorage());
  readonly policy = computed(() => this.policySignal());

  rulesFor(kind: ReminderPolicyKind): ReminderRule[] {
    return this.policySignal()[kind];
  }

  addRule(kind: ReminderPolicyKind): void {
    this.update(kind, (rules) => [...rules, rule(1, null, ['Email'])]);
  }

  removeRule(kind: ReminderPolicyKind, ruleId: string): void {
    this.update(kind, (rules) => rules.filter((r) => r.id !== ruleId));
  }

  updateRule(kind: ReminderPolicyKind, ruleId: string, patch: Partial<ReminderRule>): void {
    this.update(kind, (rules) => rules.map((r) => (r.id === ruleId ? { ...r, ...patch } : r)));
  }

  toggleChannel(
    kind: ReminderPolicyKind,
    ruleId: string,
    channel: ReminderRule['channels'][number],
  ): void {
    this.update(kind, (rules) =>
      rules.map((r) => {
        if (r.id !== ruleId) return r;
        const channels = r.channels.includes(channel)
          ? r.channels.filter((c) => c !== channel)
          : [...r.channels, channel];
        return { ...r, channels };
      }),
    );
  }

  resetToDefaults(): void {
    this.persist(defaultPolicy());
  }

  private update(kind: ReminderPolicyKind, fn: (rules: ReminderRule[]) => ReminderRule[]): void {
    this.persist({ ...this.policySignal(), [kind]: fn(this.policySignal()[kind]) });
  }

  private persist(policy: ReminderPolicy): void {
    this.policySignal.set(policy);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(policy));
    } catch {
      // Storage unavailable — preference stays in-memory for this session.
    }
  }
}
