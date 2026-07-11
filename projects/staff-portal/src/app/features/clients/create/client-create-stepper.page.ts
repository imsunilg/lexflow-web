import { DatePipe } from '@angular/common';
import { HttpErrorResponse } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSelectModule } from '@angular/material/select';
import { MatStepperModule } from '@angular/material/stepper';
import { MatTooltipModule } from '@angular/material/tooltip';
import { Router } from '@angular/router';
import { Observable, catchError, forkJoin, of, switchMap } from 'rxjs';
import {
  CLIENT_ADDRESS_KINDS,
  Client,
  ClientAddressInput,
  ClientAddressKind,
  ClientContactInput,
  ClientType,
  ClientsService,
  CreateClientRequest,
  atLeastOneRequired,
  catalogValidators,
  requiredCatalogValidators,
} from 'shared';

/** Common KYC identity document kinds seen across individual and corporate clients (PRD Module 3 §17). */
const DOC_KINDS = [
  'PAN',
  'Aadhaar',
  'Passport',
  'DriverLicense',
  'IncorporationCertificate',
  'BoardResolution',
  'GstCertificate',
] as const;

interface StagedDocument {
  docKind: string;
  docNumber: string;
  expiryDate: Date | null;
}

/**
 * Client create stepper (PRD Module 3: "create form (stepper: Basic → KYC →
 * Addresses → Portal)"). Only Step 1 (Basic) is sent as part of
 * `CreateClientRequest` directly (plus staged contacts for Corporate, since
 * `contacts` is the one nested field the DTO actually supports). KYC documents
 * and addresses have no "create with client" endpoint — they need a real
 * `clientId` first — so both are staged locally here and replayed via
 * `addAddress`/portal calls right after `create()` resolves. Identity-document
 * *files* can't be staged at all client-side (the upload endpoint takes a
 * `File`, which doesn't exist yet for an unsaved client), so Step 2 only
 * collects the planned document metadata; actual file upload happens later
 * on the client detail page's KYC tab.
 */
@Component({
  selector: 'lf-staff-client-create-stepper-page',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatButtonToggleModule,
    MatCheckboxModule,
    MatDatepickerModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatProgressSpinnerModule,
    MatSelectModule,
    MatStepperModule,
    MatTooltipModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './client-create-stepper.page.html',
  styleUrl: './client-create-stepper.page.scss',
})
export class ClientCreateStepperPage {
  private readonly clientsService = inject(ClientsService);
  private readonly router = inject(Router);

  readonly docKinds = DOC_KINDS;
  readonly addressKinds = CLIENT_ADDRESS_KINDS;

  readonly saving = signal(false);
  readonly errorMessage = signal<string | null>(null);

  readonly stagedDocuments = signal<StagedDocument[]>([]);
  readonly stagedAddresses = signal<ClientAddressInput[]>([]);
  readonly stagedContacts = signal<ClientContactInput[]>([]);

  readonly basicForm = new FormGroup(
    {
      type: new FormControl<ClientType>('Individual', { nonNullable: true }),
      firstName: new FormControl('', { nonNullable: true }),
      lastName: new FormControl('', { nonNullable: true }),
      legalName: new FormControl('', { nonNullable: true }),
      gstin: new FormControl('', { nonNullable: true, validators: catalogValidators('gstin') }),
      cin: new FormControl('', { nonNullable: true, validators: catalogValidators('cin') }),
      email: new FormControl('', { nonNullable: true, validators: catalogValidators('email') }),
      phoneE164: new FormControl('', {
        nonNullable: true,
        validators: catalogValidators('phoneE164'),
      }),
    },
    { validators: atLeastOneRequired('email', 'phoneE164') },
  );

  readonly documentForm = new FormGroup({
    docKind: new FormControl<string>(DOC_KINDS[0], { nonNullable: true }),
    docNumber: new FormControl('', { nonNullable: true }),
    expiryDate: new FormControl<Date | null>(null),
  });

  readonly addressForm = new FormGroup({
    kind: new FormControl<ClientAddressKind>('Registered', { nonNullable: true }),
    line1: new FormControl('', { nonNullable: true }),
    line2: new FormControl('', { nonNullable: true }),
    city: new FormControl('', { nonNullable: true }),
    stateCode: new FormControl('', { nonNullable: true }),
    postal: new FormControl('', { nonNullable: true }),
    country: new FormControl('', { nonNullable: true }),
    isPrimaryOfKind: new FormControl(false, { nonNullable: true }),
  });

  readonly contactForm = new FormGroup({
    name: new FormControl('', { nonNullable: true }),
    designation: new FormControl('', { nonNullable: true }),
    email: new FormControl('', { nonNullable: true }),
    phone: new FormControl('', { nonNullable: true }),
    isPrimary: new FormControl(false, { nonNullable: true }),
  });

  readonly portalControl = new FormControl(false, { nonNullable: true });

  constructor() {
    this.basicForm.controls.type.valueChanges
      .pipe(takeUntilDestroyed())
      .subscribe((type) => this.applyTypeValidators(type));
    this.applyTypeValidators(this.basicForm.controls.type.value);
  }

  private applyTypeValidators(type: ClientType): void {
    const firstName = this.basicForm.controls.firstName;
    const legalName = this.basicForm.controls.legalName;
    if (type === 'Individual') {
      firstName.setValidators(requiredCatalogValidators('name'));
      legalName.clearValidators();
    } else {
      legalName.setValidators(requiredCatalogValidators('name'));
      firstName.clearValidators();
    }
    firstName.updateValueAndValidity();
    legalName.updateValueAndValidity();
  }

  clientTypeIsCorporate(): boolean {
    return this.basicForm.controls.type.value === 'Corporate';
  }

  hasEmail(): boolean {
    return this.basicForm.controls.email.value.trim().length > 0;
  }

  canProceedFromAddressesStep(): boolean {
    return !this.clientTypeIsCorporate() || this.stagedContacts().length > 0;
  }

  // KYC staging

  addDocument(): void {
    const value = this.documentForm.getRawValue();
    if (!value.docKind || !value.docNumber.trim()) {
      this.documentForm.markAllAsTouched();
      return;
    }
    this.stagedDocuments.update((docs) => [
      ...docs,
      { docKind: value.docKind, docNumber: value.docNumber.trim(), expiryDate: value.expiryDate },
    ]);
    this.documentForm.reset({ docKind: DOC_KINDS[0], docNumber: '', expiryDate: null });
  }

  removeDocument(index: number): void {
    this.stagedDocuments.update((docs) => docs.filter((_, i) => i !== index));
  }

  // Address staging

  addAddress(): void {
    const value = this.addressForm.getRawValue();
    if (!value.line1.trim()) {
      this.addressForm.markAllAsTouched();
      return;
    }
    this.stagedAddresses.update((addresses) => [
      ...addresses,
      {
        kind: value.kind,
        line1: value.line1.trim(),
        line2: value.line2 || null,
        city: value.city || null,
        stateCode: value.stateCode || null,
        postal: value.postal || null,
        country: value.country || null,
        isPrimaryOfKind: value.isPrimaryOfKind,
      },
    ]);
    this.addressForm.reset({
      kind: 'Registered',
      line1: '',
      line2: '',
      city: '',
      stateCode: '',
      postal: '',
      country: '',
      isPrimaryOfKind: false,
    });
  }

  removeAddress(index: number): void {
    this.stagedAddresses.update((addresses) => addresses.filter((_, i) => i !== index));
  }

  // Contact staging (Corporate only)

  addContact(): void {
    const value = this.contactForm.getRawValue();
    if (!value.name.trim()) {
      this.contactForm.markAllAsTouched();
      return;
    }
    this.stagedContacts.update((contacts) => [
      ...contacts,
      {
        name: value.name.trim(),
        designation: value.designation || null,
        email: value.email || null,
        phone: value.phone || null,
        isPrimary: value.isPrimary,
      },
    ]);
    this.contactForm.reset({ name: '', designation: '', email: '', phone: '', isPrimary: false });
  }

  removeContact(index: number): void {
    this.stagedContacts.update((contacts) => contacts.filter((_, i) => i !== index));
  }

  cancel(): void {
    this.router.navigate(['/clients', 'list']);
  }

  submit(): void {
    if (this.basicForm.invalid) {
      this.basicForm.markAllAsTouched();
      return;
    }
    if (!this.canProceedFromAddressesStep()) {
      return;
    }

    this.saving.set(true);
    this.errorMessage.set(null);

    const value = this.basicForm.getRawValue();
    const isCorporate = value.type === 'Corporate';
    const request: CreateClientRequest = {
      type: value.type,
      firstName: isCorporate ? null : value.firstName || null,
      lastName: isCorporate ? null : value.lastName || null,
      legalName: isCorporate ? value.legalName || null : null,
      email: value.email || null,
      phoneE164: value.phoneE164 || null,
      gstin: isCorporate ? value.gstin || null : null,
      cin: isCorporate ? value.cin || null : null,
      contacts: isCorporate ? this.stagedContacts() : null,
    };

    this.clientsService
      .create(request)
      .pipe(
        catchError((error: unknown) => {
          this.saving.set(false);
          this.errorMessage.set(
            error instanceof HttpErrorResponse && error.status === 400
              ? 'Check the highlighted fields and try again.'
              : 'Something went wrong. Please try again.',
          );
          return of(null);
        }),
      )
      .subscribe((client) => {
        if (client) {
          this.finishAfterCreate(client);
        }
      });
  }

  /**
   * Best-effort follow-up calls: addresses and portal-access are staged only
   * client-side, so any of these failing shouldn't block navigation — the
   * client itself was already created successfully.
   */
  private finishAfterCreate(client: Client): void {
    const addresses = this.stagedAddresses();
    const addresses$: Observable<unknown> = addresses.length
      ? forkJoin(
          addresses.map((address) =>
            this.clientsService.addAddress(client.id, address).pipe(catchError(() => of(null))),
          ),
        )
      : of(null);

    addresses$
      .pipe(
        switchMap(() =>
          this.portalControl.value
            ? this.clientsService.setPortalAccess(client.id, true).pipe(catchError(() => of(null)))
            : of(null),
        ),
      )
      .subscribe(() => {
        this.saving.set(false);
        this.router.navigate(['/clients', client.id]);
      });
  }
}
