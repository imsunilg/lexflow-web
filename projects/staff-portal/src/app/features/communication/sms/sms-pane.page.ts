import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSelectModule } from '@angular/material/select';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import {
  ApiErrorEnvelope,
  ClientsService,
  CommSmsService,
  CommTemplate,
  CommTemplatesService,
  EmptyStateComponent,
  SmsMessage,
} from 'shared';
import { CommTabsComponent } from '../comm-tabs.component';

interface ClientOption {
  id: string;
  label: string;
  phoneE164: string | null;
}

/** Naive `{{key}}` substitution — a local mirror of the server's own SMS interpolation, for preview only; the raw `variables` dict is what's actually sent. */
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
 * SMS pane (PRD Module 11): pick a client, view SMS history as chat bubbles,
 * send a new SMS. DLT enforcement is real and server-side — under the
 * default tenant config (`dltRequired` unset ⇒ `true`), a freeform send
 * without a `templateId` is effectively always rejected with 422
 * `DLT_TEMPLATE_REQUIRED`. The template picker therefore defaults to
 * template mode; picking "freeform" shows a non-blocking heads-up, since the
 * UI can't know the tenant's actual gateway config.
 */
@Component({
  selector: 'lf-sms-pane-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressBarModule,
    MatSelectModule,
    EmptyStateComponent,
    CommTabsComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './sms-pane.page.html',
  styleUrl: './sms-pane.page.scss',
})
export class SmsPanePage {
  private readonly clientsService = inject(ClientsService);
  private readonly commSmsService = inject(CommSmsService);
  private readonly commTemplatesService = inject(CommTemplatesService);

  readonly clientControl = new FormControl('', { nonNullable: true });
  readonly clientResults = signal<ClientOption[]>([]);
  readonly activeClient = signal<ClientOption | null>(null);

  readonly loading = signal(false);
  readonly messages = signal<SmsMessage[]>([]);

  readonly templates = signal<CommTemplate[]>([]);
  readonly selectedTemplateId = new FormControl<string | null>(null);
  readonly variableValues = signal<Record<string, string>>({});
  readonly toNumber = new FormControl('', { nonNullable: true });
  readonly freeformBody = new FormControl('', { nonNullable: true });

  readonly sending = signal(false);
  readonly sendError = signal<string | null>(null);

  readonly selectedTemplate = computed(() =>
    this.templates().find((t) => t.id === this.selectedTemplateId.value),
  );
  readonly variableNames = computed(() => {
    const template = this.selectedTemplate();
    return template ? parseVariableNames(template.variablesJson) : [];
  });
  readonly mergedPreview = computed(() => {
    const template = this.selectedTemplate();
    const source = template ? template.body : this.freeformBody.value;
    return applyMerge(source, this.variableValues());
  });
  readonly isFreeform = computed(() => !this.selectedTemplate());

  constructor() {
    this.commTemplatesService.list('SMS').subscribe((templates) => this.templates.set(templates));

    this.clientControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        if (!q) {
          this.clientResults.set([]);
          return;
        }
        this.clientsService.list({ q }).subscribe((clients) => {
          this.clientResults.set(
            clients.map((c) => ({
              id: c.id,
              label: c.displayName ?? c.legalName ?? c.number,
              phoneE164: c.phoneE164,
            })),
          );
        });
      });

    this.selectedTemplateId.valueChanges.subscribe(() => {
      const names = this.variableNames();
      this.variableValues.set(Object.fromEntries(names.map((n) => [n, ''])));
      this.sendError.set(null);
    });
  }

  onClientSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const client = this.clientResults().find((c) => c.label === label);
    if (!client) return;
    this.activeClient.set(client);
    this.toNumber.setValue(client.phoneE164 ?? '');
    this.sendError.set(null);
    this.load();
  }

  load(): void {
    const client = this.activeClient();
    if (!client) return;
    this.loading.set(true);
    this.commSmsService.listForClient(client.id).subscribe({
      next: (messages) => {
        this.messages.set(messages);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onVariableInput(name: string, value: string): void {
    this.variableValues.update((current) => ({ ...current, [name]: value }));
  }

  send(): void {
    const client = this.activeClient();
    const toNumber = this.toNumber.value.trim();
    if (!client || !toNumber) return;

    const template = this.selectedTemplate();
    if (!template && !this.freeformBody.value.trim()) return;

    this.sending.set(true);
    this.sendError.set(null);
    this.commSmsService
      .send({
        clientId: client.id,
        toNumber,
        templateId: template?.id ?? null,
        variables: template ? this.variableValues() : null,
        freeformBody: template ? null : this.freeformBody.value,
      })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.freeformBody.setValue('');
          this.load();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.sendError.set(this.extractErrorMessage(error));
        },
      });
  }

  private extractErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      const envelope = error.error as Partial<ApiErrorEnvelope> | null;
      return envelope?.error?.message ?? 'Send failed. Please try again.';
    }
    return 'Send failed. Please try again.';
  }
}
