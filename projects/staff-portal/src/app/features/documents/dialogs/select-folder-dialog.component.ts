import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { Folder, FoldersService } from 'shared';
import { FolderTreeComponent } from '../folder-tree.component';

export interface SelectFolderDialogData {
  title: string;
  matterId?: string | null;
}

/** Folder picker reused for "move to folder" bulk/single-document actions. */
@Component({
  selector: 'lf-select-folder-dialog',
  standalone: true,
  imports: [MatButtonModule, MatDialogModule, FolderTreeComponent],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title>{{ data.title }}</h2>
    <mat-dialog-content style="min-width: 360px; max-height: 400px">
      <lf-folder-tree
        [folders]="folders()"
        [selectedId]="selectedId()"
        (folderSelected)="selectedId.set($event)"
      />
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button type="button" [mat-dialog-close]="undefined">Cancel</button>
      <button mat-flat-button color="primary" type="button" (click)="dialogRef.close(selectedId())">
        Select
      </button>
    </mat-dialog-actions>
  `,
})
export class SelectFolderDialogComponent {
  private readonly foldersService = inject(FoldersService);
  readonly dialogRef =
    inject<MatDialogRef<SelectFolderDialogComponent, string | null | undefined>>(MatDialogRef);
  readonly data = inject<SelectFolderDialogData>(MAT_DIALOG_DATA);

  readonly folders = signal<Folder[]>([]);
  readonly selectedId = signal<string | null>(null);

  constructor() {
    this.foldersService.list(undefined, this.data.matterId ?? undefined).subscribe((folders) => {
      this.folders.set(folders);
    });
  }
}
