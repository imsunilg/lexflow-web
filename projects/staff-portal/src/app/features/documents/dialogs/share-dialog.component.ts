import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { CreateShareLinkResult, DocumentsService, LfDocument } from 'shared';

export interface ShareDialogData {
  document: LfDocument;
}

const MAX_SHARE_EXPIRY_DAYS = 30;

/**
 * Share dialog (PRD Module 7 §7 Share, §Validation Rules). Only the
 * "External Link" tab is fully functional — Team Access and Client Portal
 * are confirmed backend gaps (no internal-permissions endpoint and no
 * publish-toggle endpoint exist despite DB tables/fields for them), so those
 * tabs show honest banners instead of fake forms. There is also no
 * list-existing-links endpoint, so only links created in this dialog
 * session can be shown/revoked here.
 */
@Component({
  selector: 'lf-share-dialog',
  standalone: true,
  imports: [
    DatePipe,
    ReactiveFormsModule,
    MatButtonModule,
    MatDatepickerModule,
    MatDialogModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatTabsModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './share-dialog.component.html',
  styleUrl: './share-dialog.component.scss',
})
export class ShareDialogComponent {
  private readonly documentsService = inject(DocumentsService);
  readonly data = inject<ShareDialogData>(MAT_DIALOG_DATA);

  readonly maxExpiryDate = (() => {
    const date = new Date();
    date.setDate(date.getDate() + MAX_SHARE_EXPIRY_DAYS);
    return date;
  })();

  readonly isPrivileged = computed(() => this.data.document.confidentiality === 'Privileged');

  readonly creating = signal(false);
  readonly revoking = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly createdLink = signal<CreateShareLinkResult | null>(null);
  readonly copied = signal(false);

  readonly form = new FormGroup({
    expiresAt: new FormControl<Date | null>(null, { validators: [Validators.required] }),
    password: new FormControl(''),
    maxDownloads: new FormControl<number | null>(null),
    watermarkEmail: new FormControl(''),
  });

  shareUrl(link: CreateShareLinkResult): string {
    return `${window.location.origin}/shared/${link.token}`;
  }

  createLink(): void {
    if (this.form.invalid || this.isPrivileged()) return;

    const value = this.form.getRawValue();
    this.creating.set(true);
    this.errorMessage.set(null);
    this.documentsService
      .createShareLink(this.data.document.id, {
        expiresAt: (value.expiresAt as Date).toISOString(),
        password: value.password || null,
        maxDownloads: value.maxDownloads || null,
        watermark: value.watermarkEmail ? `Prepared for ${value.watermarkEmail}` : null,
      })
      .subscribe({
        next: (result) => {
          this.creating.set(false);
          this.createdLink.set(result);
        },
        error: () => {
          this.creating.set(false);
          this.errorMessage.set('Could not create the share link. Please try again.');
        },
      });
  }

  copyLink(): void {
    const link = this.createdLink();
    if (!link) return;
    navigator.clipboard.writeText(this.shareUrl(link)).then(() => {
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 2000);
    });
  }

  revokeLink(): void {
    const link = this.createdLink();
    if (!link) return;
    this.revoking.set(true);
    this.documentsService.deleteShareLink(link.id).subscribe({
      next: () => {
        this.revoking.set(false);
        this.createdLink.set(null);
        this.form.reset();
      },
      error: () => {
        this.revoking.set(false);
        this.errorMessage.set('Could not revoke the link. Please try again.');
      },
    });
  }
}
