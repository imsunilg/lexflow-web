import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  CommTemplate,
  CommTemplatesService,
  EmailThread,
  Matter,
  MattersService,
  CommEmailService,
} from 'shared';
import { KnownMailbox } from './mailbox-registry.service';

export interface EmailComposerDialogData {
  mailboxes: KnownMailbox[];
  replyTo?: {
    mailboxId: string;
    threadId: string;
    toAddresses: string[];
    subject: string;
    inReplyToMessageIdHdr: string;
    matterId: string | null;
    clientId: string | null;
  };
}

function escapeHtml(text: string): string {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

/** Naive `{{key}}` substitution — mirrors the server's own (equally naive) SMS/WhatsApp interpolation exactly, per the confirmed backend behavior. */
function applyMerge(body: string, variables: Record<string, string>): string {
  let result = body;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replaceAll(`{{${key}}}`, value || `{{${key}}}`);
  }
  return result;
}

function parseVariableNames(variablesJson: string): string[] {
  try {
    const parsed: unknown = JSON.parse(variablesJson);
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === 'string') : [];
  } catch {
    return [];
  }
}

/**
 * Email composer (PRD Module 11 UI Components: "composer (rich text,
 * template picker, merge preview)"). There is no rich-text editor in this
 * codebase and no server-side email templating at all (confirmed: the send
 * endpoint has no template/variable fields) — this composer edits plain
 * text, escapes it into paragraphs client-side for `bodyHtml`, and applies
 * any chosen template's merge fields locally before sending. The "merge
 * preview" is a genuine preview of exactly what will be sent, not a proxy
 * for server-side rendering (there is none for email).
 */
@Component({
  selector: 'lf-email-composer-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './email-composer-dialog.component.html',
  styleUrl: './email-composer-dialog.component.scss',
})
export class EmailComposerDialogComponent {
  private readonly dialogRef =
    inject<MatDialogRef<EmailComposerDialogComponent, EmailThread | undefined>>(MatDialogRef);
  readonly data = inject<EmailComposerDialogData>(MAT_DIALOG_DATA);
  private readonly commEmailService = inject(CommEmailService);
  private readonly commTemplatesService = inject(CommTemplatesService);
  private readonly mattersService = inject(MattersService);

  readonly isReply = !!this.data.replyTo;

  readonly mailboxId = new FormControl(
    this.data.replyTo?.mailboxId ?? this.data.mailboxes[0]?.id ?? '',
    {
      nonNullable: true,
      validators: [Validators.required],
    },
  );
  readonly toAddresses = new FormControl(this.data.replyTo?.toAddresses.join(', ') ?? '', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly subject = new FormControl(this.data.replyTo?.subject ?? '', {
    nonNullable: true,
    validators: [Validators.required],
  });
  readonly body = new FormControl('', { nonNullable: true, validators: [Validators.required] });

  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterResults = signal<Matter[]>([]);
  private selectedMatterId: string | null = this.data.replyTo?.matterId ?? null;

  readonly templates = signal<CommTemplate[]>([]);
  readonly selectedTemplateId = new FormControl<string | null>(null);
  readonly variableValues = signal<Record<string, string>>({});

  readonly selectedTemplate = computed(() =>
    this.templates().find((t) => t.id === this.selectedTemplateId.value),
  );
  readonly variableNames = computed(() => {
    const template = this.selectedTemplate();
    return template ? parseVariableNames(template.variablesJson) : [];
  });

  readonly mergedPreview = computed(() => {
    const template = this.selectedTemplate();
    const source = template ? template.body : this.body.value;
    return applyMerge(source, this.variableValues());
  });

  submitting = false;

  constructor() {
    this.commTemplatesService.list('Email').subscribe((templates) => this.templates.set(templates));

    this.matterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedMatterId = null;
        if (!q) {
          this.matterResults.set([]);
          return;
        }
        this.mattersService.list({ q }).subscribe((matters) => this.matterResults.set(matters));
      });

    this.selectedTemplateId.valueChanges.subscribe(() => {
      const names = this.variableNames();
      this.variableValues.set(Object.fromEntries(names.map((n) => [n, ''])));
    });
  }

  onVariableInput(name: string, value: string): void {
    this.variableValues.update((current) => ({ ...current, [name]: value }));
  }

  onMatterSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => `${m.number} — ${m.title}` === label);
    this.selectedMatterId = matter?.id ?? null;
  }

  matterLabel(matter: Matter): string {
    return `${matter.number} — ${matter.title}`;
  }

  cancel(): void {
    this.dialogRef.close(undefined);
  }

  send(): void {
    const template = this.selectedTemplate();
    if (!template && this.body.invalid) {
      this.body.markAsTouched();
      return;
    }
    if (this.mailboxId.invalid || this.toAddresses.invalid || this.subject.invalid) {
      this.mailboxId.markAsTouched();
      this.toAddresses.markAsTouched();
      this.subject.markAsTouched();
      return;
    }

    const finalText = this.mergedPreview();
    const bodyHtml = finalText
      .split('\n')
      .map((line) => `<p>${escapeHtml(line)}</p>`)
      .join('');

    this.submitting = true;
    this.commEmailService
      .send({
        mailboxId: this.mailboxId.value,
        toAddresses: this.toAddresses.value
          .split(',')
          .map((a) => a.trim())
          .filter(Boolean),
        subject: this.subject.value,
        bodyHtml,
        inReplyToMessageIdHdr: this.data.replyTo?.inReplyToMessageIdHdr ?? null,
        matterId: this.selectedMatterId,
        clientId: this.data.replyTo?.clientId ?? null,
      })
      .subscribe({
        next: (thread) => this.dialogRef.close(thread),
        error: () => {
          this.submitting = false;
        },
      });
  }
}
