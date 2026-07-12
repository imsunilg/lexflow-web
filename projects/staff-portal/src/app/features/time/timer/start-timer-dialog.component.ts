import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import {
  MatAutocompleteModule,
  MatAutocompleteSelectedEvent,
} from '@angular/material/autocomplete';
import { MatButtonModule } from '@angular/material/button';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { debounceTime, distinctUntilChanged } from 'rxjs';
import { Matter, MattersService, StartTimerRequest } from 'shared';

/** "Start (pick matter+activity via typeahead, or start blank and classify later)" — PRD Module 9 User Flow 1. There's no activity-codes lookup endpoint, so only the matter is picked here. */
@Component({
  selector: 'lf-start-timer-dialog',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatAutocompleteModule,
    MatButtonModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <h2 mat-dialog-title i18n="@@time.startTimerDialog.title">Start timer</h2>
    <mat-dialog-content>
      <mat-form-field appearance="outline" style="width: 360px">
        <mat-label i18n="@@time.startTimerDialog.matterLabel">Matter (optional)</mat-label>
        <input matInput [formControl]="matterControl" [matAutocomplete]="matterAuto" />
        <mat-autocomplete #matterAuto="matAutocomplete" (optionSelected)="onSelected($event)">
          @for (matter of matterResults(); track matter.id) {
            <mat-option [value]="matter.number + ' — ' + matter.title">
              {{ matter.number }} — {{ matter.title }}
            </mat-option>
          }
        </mat-autocomplete>
        <mat-hint i18n="@@time.startTimerDialog.hint">Leave blank to classify later.</mat-hint>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button
        mat-button
        type="button"
        [mat-dialog-close]="undefined"
        i18n="@@time.startTimerDialog.cancelButton"
      >
        Cancel
      </button>
      <button
        mat-flat-button
        color="primary"
        type="button"
        (click)="submit()"
        i18n="@@time.startTimerDialog.startButton"
      >
        Start
      </button>
    </mat-dialog-actions>
  `,
})
export class StartTimerDialogComponent {
  private readonly mattersService = inject(MattersService);
  private readonly dialogRef =
    inject<MatDialogRef<StartTimerDialogComponent, StartTimerRequest | undefined>>(MatDialogRef);

  readonly matterControl = new FormControl('', { nonNullable: true });
  readonly matterResults = signal<Matter[]>([]);
  readonly selectedMatterId = signal<string | null>(null);

  constructor() {
    this.matterControl.valueChanges
      .pipe(debounceTime(250), distinctUntilChanged(), takeUntilDestroyed())
      .subscribe((q) => {
        this.selectedMatterId.set(null);
        if (!q) {
          this.matterResults.set([]);
          return;
        }
        this.mattersService.list({ q }).subscribe((matters) => this.matterResults.set(matters));
      });
  }

  onSelected(event: MatAutocompleteSelectedEvent): void {
    const label = event.option.value as string;
    const matter = this.matterResults().find((m) => `${m.number} — ${m.title}` === label);
    if (matter) this.selectedMatterId.set(matter.id);
  }

  submit(): void {
    this.dialogRef.close({ matterId: this.selectedMatterId() });
  }
}
