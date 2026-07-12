/*
 * Public API Surface of shared
 */

// Models
export * from './lib/models/auth.models';
export * from './lib/models/api-envelope.models';
export * from './lib/models/search.models';
export * from './lib/models/notification.models';
export * from './lib/models/timer.models';
export * from './lib/models/dashboard.models';
export * from './lib/models/lead.models';
export * from './lib/models/client.models';
export * from './lib/models/matter.models';
export * from './lib/models/court-case.models';
export * from './lib/models/calendar.models';
export * from './lib/models/document.models';
export * from './lib/models/billing.models';
export * from './lib/models/time-entry.models';
export * from './lib/models/task.models';
export * from './lib/models/user.models';
export * from './lib/models/communication.models';
export * from './lib/models/kb.models';
export * from './lib/models/reports.models';
export * from './lib/models/user-management.models';
export * from './lib/models/settings.models';
export * from './lib/models/workflow-rules.models';
export * from './lib/models/ai.models';

// Services
export * from './lib/services/api-base-url.token';
export * from './lib/services/hub-base-url.token';
export * from './lib/services/auth-token.service';
export * from './lib/services/auth.service';
export * from './lib/services/permission.service';
export * from './lib/services/realtime-hub.service';
export * from './lib/services/search.service';
export * from './lib/services/notifications.service';
export * from './lib/services/timer.service';
export * from './lib/services/dashboard-layout.service';
export * from './lib/services/dashboard-widgets.service';
export * from './lib/services/dashboard-realtime.service';
export * from './lib/services/leads.service';
export * from './lib/services/lead-lookups.service';
export * from './lib/services/saved-lead-views.service';
export * from './lib/services/clients.service';
export * from './lib/services/matters.service';
export * from './lib/services/court-cases.service';
export * from './lib/services/hearings.service';
export * from './lib/services/court-lookups.service';
export * from './lib/services/saved-matter-views.service';
export * from './lib/services/calendar.service';
export * from './lib/services/documents.service';
export * from './lib/services/folders.service';
export * from './lib/services/document-templates.service';
export * from './lib/services/invoices.service';
export * from './lib/services/payments.service';
export * from './lib/services/trust.service';
export * from './lib/services/billing-reports.service';
export * from './lib/services/rate-cards.service';
export * from './lib/services/dunning.service';
export * from './lib/services/time-entries.service';
export * from './lib/services/tasks.service';
export * from './lib/services/task-templates.service';
export * from './lib/services/users.service';
export * from './lib/services/comm-email.service';
export * from './lib/services/comm-sms.service';
export * from './lib/services/comm-whatsapp.service';
export * from './lib/services/comm-calls.service';
export * from './lib/services/comm-templates.service';
export * from './lib/services/comm-timeline.service';
export * from './lib/services/chat.service';
export * from './lib/services/chat-hub.service';
export * from './lib/services/kb-acts.service';
export * from './lib/services/kb-judgments.service';
export * from './lib/services/kb-articles.service';
export * from './lib/services/kb-matter-pins.service';
export * from './lib/services/kb-taxonomy.service';
export * from './lib/services/kb-search.service';
export * from './lib/services/reports.service';
export * from './lib/services/custom-reports.service';
export * from './lib/services/report-schedules.service';
export * from './lib/services/report-favorites.service';
export * from './lib/services/roles.service';
export * from './lib/services/teams.service';
export * from './lib/services/departments.service';
export * from './lib/services/branches.service';
export * from './lib/services/sessions.service';
export * from './lib/services/login-history.service';
export * from './lib/services/settings.service';
export * from './lib/services/number-series.service';
export * from './lib/services/tax-rates.service';
export * from './lib/services/workflow-rules.service';
export * from './lib/services/ai.service';
export * from './lib/services/ai-context.service';
export * from './lib/services/offline-mutation-queue.service';

// Interceptors
export * from './lib/interceptors/auth.interceptor';
export * from './lib/interceptors/error-envelope.interceptor';
export * from './lib/interceptors/idempotency-key.interceptor';

// Guards
export * from './lib/guards/auth.guard';
export * from './lib/guards/permission.guard';

// Pipes
export * from './lib/pipes/lf-currency.pipe';

// Validation
export * from './lib/validation/validation-catalog';
export * from './lib/validation/validation-catalog.validators';

// Components
export * from './lib/components/dashboard-widget/dashboard-widget.component';
export * from './lib/components/data-table/data-table.component';
export * from './lib/components/empty-state/empty-state.component';
export * from './lib/components/confirm-dialog/confirm-dialog.component';
export * from './lib/components/file-uploader/file-uploader.component';
export * from './lib/components/date-range-picker/date-range-picker.component';
export * from './lib/components/status-chip/status-chip.component';
export * from './lib/components/communication-timeline/communication-timeline.component';
export * from './lib/components/ai-badge/ai-badge.component';
export * from './lib/components/offline-banner/offline-banner.component';
