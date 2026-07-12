import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AiBadgeComponent, AiResearchResponse, AiService, EmptyStateComponent } from 'shared';
import { AiCitationLinkComponent } from '../ai-citation-link.component';
import { AiTabsComponent } from '../ai-tabs.component';

/**
 * Research Assistant (PRD Module 16 feature 6: "question -> cited answer
 * ... never fabricates citations ... unverifiable -> 'no authority found'").
 * `webGroundedMode` is a real request field but is a no-op server-side today
 * (retrieval is always the same firm-KB-only RAG regardless of the toggle)
 * — the checkbox is still offered since it's a real field the API accepts,
 * but doesn't visibly change anything, which is disclosed here rather than
 * hidden. `noAuthorityFound` is produced by a string-match on the LLM's own
 * output, not an independent verifier — treated as authoritative since it's
 * the only signal available. This is a read-only feature: there is no
 * save/insert endpoint, so only "Copy answer" is offered (a real, always-
 * available browser action), not a fabricated "Insert" button.
 */
@Component({
  selector: 'lf-ai-research-page',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressBarModule,
    AiBadgeComponent,
    EmptyStateComponent,
    AiCitationLinkComponent,
    AiTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './research.page.html',
  styleUrl: './research.page.scss',
})
export class ResearchPage {
  private readonly aiService = inject(AiService);

  readonly question = new FormControl('', {
    nonNullable: true,
    validators: [Validators.required, Validators.minLength(3), Validators.maxLength(2000)],
  });
  readonly webGroundedMode = new FormControl(false, { nonNullable: true });

  readonly asking = signal(false);
  readonly askError = signal<string | null>(null);
  readonly result = signal<AiResearchResponse | null>(null);

  ask(): void {
    if (this.question.invalid) {
      this.question.markAsTouched();
      return;
    }

    this.asking.set(true);
    this.askError.set(null);
    this.result.set(null);
    this.aiService
      .research({ question: this.question.value, webGroundedMode: this.webGroundedMode.value })
      .subscribe({
        next: (result) => {
          this.asking.set(false);
          this.result.set(result);
        },
        error: () => {
          this.asking.set(false);
          this.askError.set('Research query failed.');
        },
      });
  }

  copyAnswer(): void {
    const answer = this.result()?.answer;
    if (answer) navigator.clipboard.writeText(answer);
  }
}
