import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { DocumentTemplate, DocumentTemplatesService, EmptyStateComponent } from 'shared';

/** PRD Module 7 User Flow 5: "firm template library" gallery, card grid. */
@Component({
  selector: 'lf-template-gallery-dialog',
  standalone: true,
  imports: [
    MatButtonModule,
    MatCardModule,
    MatDialogModule,
    MatProgressSpinnerModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './template-gallery-dialog.component.html',
  styleUrl: './template-gallery-dialog.component.scss',
})
export class TemplateGalleryDialogComponent {
  private readonly documentTemplatesService = inject(DocumentTemplatesService);
  private readonly dialogRef =
    inject<MatDialogRef<TemplateGalleryDialogComponent, DocumentTemplate | undefined>>(
      MatDialogRef,
    );

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly templates = signal<DocumentTemplate[]>([]);

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.documentTemplatesService.list().subscribe({
      next: (templates) => {
        this.templates.set(templates);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  select(template: DocumentTemplate): void {
    this.dialogRef.close(template);
  }
}
