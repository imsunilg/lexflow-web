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
  CommTemplate,
  CommTemplatesService,
  CommWhatsAppService,
  EmptyStateComponent,
  WhatsappMessage,
} from 'shared';
import { CommTabsComponent } from '../comm-tabs.component';

interface ClientOption {
  id: string;
  label: string;
  phoneE164: string | null;
}

/** Naive `{{key}}` substitution — a local mirror of the server's own WhatsApp template interpolation, for preview only; the raw `variables` dict is what's actually sent. */
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
 * WhatsApp pane (PRD Module 11): pick a client, view WhatsApp history as chat
 * bubbles, send a template message or (only inside the 24h session window) a
 * freeform session message. There is no dedicated "is the window open" or
 * "is there an active opt-in" endpoint — both are derived client-side from
 * history, per `communication.models.ts`'s doc comments:
 * - The session window is computed from the most recent **inbound**
 *   message's `windowExpiresAt` (outbound messages never carry one).
 * - Opt-in status can't be read at all — an inbound message implies some
 *   engagement, but not a real opt-in record, so this page never claims to
 *   know opt-in state; it just offers explicit "Record opt-in"/"Opt out"
 *   actions and surfaces the server's rejection message if a send fails for
 *   opt-in reasons.
 */
@Component({
  selector: 'lf-whatsapp-pane-page',
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
  templateUrl: './whatsapp-pane.page.html',
  styleUrl: './whatsapp-pane.page.scss',
})
export class WhatsAppPanePage {
  private readonly clientsService = inject(ClientsService);
  private readonly commWhatsAppService = inject(CommWhatsAppService);
  private readonly commTemplatesService = inject(CommTemplatesService);

  readonly clientControl = new FormControl('', { nonNullable: true });
  readonly clientResults = signal<ClientOption[]>([]);
  readonly activeClient = signal<ClientOption | null>(null);

  readonly loading = signal(false);
  readonly messages = signal<WhatsappMessage[]>([]);

  readonly templates = signal<CommTemplate[]>([]);
  readonly selectedTemplateId = new FormControl<string | null>(null);
  readonly variableValues = signal<Record<string, string>>({});
  readonly sessionText = new FormControl('', { nonNullable: true });

  readonly sending = signal(false);
  readonly sendError = signal<string | null>(null);
  readonly optInBusy = signal(false);
  readonly optInMessage = signal<string | null>(null);

  readonly selectedTemplate = computed(() =>
    this.templates().find((t) => t.id === this.selectedTemplateId.value),
  );
  readonly variableNames = computed(() => {
    const template = this.selectedTemplate();
    return template ? parseVariableNames(template.variablesJson) : [];
  });
  readonly mergedPreview = computed(() => {
    const template = this.selectedTemplate();
    if (!template) return '';
    return applyMerge(template.body, this.variableValues());
  });

  /** Most recent **inbound** message — only inbound messages carry a real `windowExpiresAt`. */
  private readonly latestInbound = computed(() => {
    const inbound = this.messages().filter((m) => m.direction === 'Inbound');
    if (inbound.length === 0) return null;
    return inbound.reduce((latest, m) =>
      new Date(m.windowExpiresAt ?? 0) > new Date(latest.windowExpiresAt ?? 0) ? m : latest,
    );
  });

  readonly sessionWindowExpiresAt = computed(() => this.latestInbound()?.windowExpiresAt ?? null);

  readonly sessionWindowOpen = computed(() => {
    const expiresAt = this.sessionWindowExpiresAt();
    if (!expiresAt) return false;
    return new Date(expiresAt).getTime() > Date.now();
  });

  constructor() {
    this.commTemplatesService
      .list('WhatsApp')
      .subscribe((templates) => this.templates.set(templates));

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
    this.sendError.set(null);
    this.optInMessage.set(null);
    this.load();
  }

  load(): void {
    const client = this.activeClient();
    if (!client) return;
    this.loading.set(true);
    this.commWhatsAppService.listForClient(client.id).subscribe({
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

  recordOptIn(): void {
    const client = this.activeClient();
    if (!client) return;
    const phoneE164 = window.prompt(
      'Phone number to opt in (E.164 format)',
      client.phoneE164 ?? '',
    );
    if (!phoneE164) return;

    this.optInBusy.set(true);
    this.optInMessage.set(null);
    this.commWhatsAppService.optIn(client.id, { phoneE164, source: 'staff-portal' }).subscribe({
      next: () => {
        this.optInBusy.set(false);
        this.optInMessage.set('Opt-in recorded.');
      },
      error: (error: unknown) => {
        this.optInBusy.set(false);
        this.optInMessage.set(this.extractErrorMessage(error));
      },
    });
  }

  optOut(): void {
    const client = this.activeClient();
    if (!client) return;

    this.optInBusy.set(true);
    this.optInMessage.set(null);
    this.commWhatsAppService.optOut(client.id).subscribe({
      next: () => {
        this.optInBusy.set(false);
        this.optInMessage.set('Client opted out.');
      },
      error: (error: unknown) => {
        this.optInBusy.set(false);
        this.optInMessage.set(this.extractErrorMessage(error));
      },
    });
  }

  sendTemplate(): void {
    const client = this.activeClient();
    const template = this.selectedTemplate();
    if (!client || !template) return;

    this.sending.set(true);
    this.sendError.set(null);
    this.commWhatsAppService
      .send({ clientId: client.id, templateId: template.id, variables: this.variableValues() })
      .subscribe({
        next: () => {
          this.sending.set(false);
          this.load();
        },
        error: (error: unknown) => {
          this.sending.set(false);
          this.sendError.set(this.extractErrorMessage(error));
        },
      });
  }

  sendSession(): void {
    const client = this.activeClient();
    const text = this.sessionText.value.trim();
    if (!client || !text || !this.sessionWindowOpen()) return;

    this.sending.set(true);
    this.sendError.set(null);
    this.commWhatsAppService.send({ clientId: client.id, sessionText: text }).subscribe({
      next: () => {
        this.sending.set(false);
        this.sessionText.setValue('');
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
      return envelope?.error?.message ?? 'Request failed. Please try again.';
    }
    return 'Request failed. Please try again.';
  }
}
