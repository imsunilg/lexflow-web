import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTooltipModule } from '@angular/material/tooltip';
import { REMINDER_CHANNELS, ReminderChannel } from 'shared';
import { REMINDER_POLICY_KINDS, ReminderPolicyKind, ReminderRule } from './reminder-policy.models';
import { ReminderPolicyService } from './reminder-policy.service';

/**
 * Reminder-policy editor (PRD Module 6 UI Components). No backend endpoint
 * for type-level reminder defaults exists — see the JSDoc on
 * `ReminderPolicyService` for the full honest-gap explanation. This editor
 * is entirely client-side/localStorage; nothing here dispatches a real
 * reminder until a matching per-event override is also added in the event
 * dialog.
 */
@Component({
  selector: 'lf-reminder-policy-tab',
  standalone: true,
  imports: [
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './reminder-policy-tab.component.html',
  styleUrl: './reminder-policy-tab.component.scss',
})
export class ReminderPolicyTabComponent {
  private readonly reminderPolicyService = inject(ReminderPolicyService);

  readonly kinds = REMINDER_POLICY_KINDS;
  readonly channels = REMINDER_CHANNELS;
  readonly policy = this.reminderPolicyService.policy;

  rulesFor(kind: ReminderPolicyKind): ReminderRule[] {
    return this.reminderPolicyService.rulesFor(kind);
  }

  addRule(kind: ReminderPolicyKind): void {
    this.reminderPolicyService.addRule(kind);
  }

  removeRule(kind: ReminderPolicyKind, ruleId: string): void {
    this.reminderPolicyService.removeRule(kind, ruleId);
  }

  setOffsetDays(kind: ReminderPolicyKind, ruleId: string, offsetDays: number): void {
    this.reminderPolicyService.updateRule(kind, ruleId, { offsetDays: Math.max(0, offsetDays) });
  }

  setFixedTime(kind: ReminderPolicyKind, ruleId: string, fixedTime: string): void {
    this.reminderPolicyService.updateRule(kind, ruleId, { fixedTime: fixedTime || null });
  }

  clearFixedTime(kind: ReminderPolicyKind, ruleId: string): void {
    this.reminderPolicyService.updateRule(kind, ruleId, { fixedTime: null });
  }

  hasChannel(rule: ReminderRule, channel: ReminderChannel): boolean {
    return rule.channels.includes(channel);
  }

  toggleChannel(kind: ReminderPolicyKind, ruleId: string, channel: ReminderChannel): void {
    this.reminderPolicyService.toggleChannel(kind, ruleId, channel);
  }

  resetToDefaults(): void {
    this.reminderPolicyService.resetToDefaults();
  }
}
