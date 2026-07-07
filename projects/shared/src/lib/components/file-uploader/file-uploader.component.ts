import { ChangeDetectionStrategy, Component, input, output, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressBarModule } from '@angular/material/progress-bar';

/**
 * Drag-and-drop + click-to-browse uploader shell. Size/type validation mirrors
 * PRD §27 (magic-byte check happens server-side; this is the client-side UX
 * layer only — `accept`/`maxSizeBytes` are advisory, not the security boundary).
 */
@Component({
  selector: 'lf-file-uploader',
  standalone: true,
  imports: [MatButtonModule, MatIconModule, MatProgressBarModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div
      class="lf-file-uploader"
      [class.lf-file-uploader--dragover]="dragOver()"
      (dragover)="onDragOver($event)"
      (dragleave)="dragOver.set(false)"
      (drop)="onDrop($event)"
    >
      <mat-icon>cloud_upload</mat-icon>
      <p>Drag files here or</p>
      <button mat-stroked-button type="button" (click)="fileInput.click()">Browse files</button>
      <input
        #fileInput
        type="file"
        hidden
        [multiple]="multiple()"
        [accept]="accept()"
        (change)="onFileInputChange($event)"
      />

      @if (progress() !== null) {
        <mat-progress-bar mode="determinate" [value]="progress()" />
      }
    </div>
  `,
  styles: `
    .lf-file-uploader {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--lf-space-1);
      border: 2px dashed var(--lf-outline);
      border-radius: var(--lf-radius);
      padding: var(--lf-space-3);
      text-align: center;
      transition: var(--lf-motion-fast);
    }

    .lf-file-uploader--dragover {
      border-color: var(--lf-primary);
      background: var(--lf-primary-container);
    }
  `,
})
export class FileUploaderComponent {
  readonly multiple = input(false);
  readonly accept = input<string>('');
  readonly progress = input<number | null>(null);
  readonly filesSelected = output<File[]>();

  readonly dragOver = signal(false);

  onDragOver(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(true);
  }

  onDrop(event: DragEvent): void {
    event.preventDefault();
    this.dragOver.set(false);
    const files = event.dataTransfer?.files;
    if (files?.length) {
      this.filesSelected.emit(Array.from(files));
    }
  }

  onFileInputChange(event: Event): void {
    const files = (event.target as HTMLInputElement).files;
    if (files?.length) {
      this.filesSelected.emit(Array.from(files));
    }
  }
}
