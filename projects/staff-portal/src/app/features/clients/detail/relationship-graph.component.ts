import { ChangeDetectionStrategy, Component, computed, inject, input, signal } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { Router } from '@angular/router';
import {
  CLIENT_RELATIONSHIP_TYPES,
  Client,
  ClientRelationship,
  ClientRelationshipType,
  ClientsService,
  EmptyStateComponent,
} from 'shared';

interface GraphNode {
  id: string;
  label: string;
  relationType: ClientRelationshipType;
  relatedClientId: string | null;
  x: number;
  y: number;
}

const RADIUS = 140;
const CENTER = 180;

/**
 * "Relationship graph visual (simple node-link, Mermaid-style render)" (PRD
 * Module 3 UI Components). No graph-rendering library (Mermaid, D3,
 * cytoscape, etc.) is a dependency in this app, and these graphs are always
 * small (a handful of family/corporate-group/referral links) — so this is a
 * hand-rolled radial SVG layout rather than pulling in a new dependency for
 * what's a few nodes and lines.
 */
@Component({
  selector: 'lf-relationship-graph',
  standalone: true,
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    EmptyStateComponent,
  ],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="relationship-graph">
      @if (loading()) {
        <p i18n="@@clients.relationshipGraph.loading">Loading…</p>
      } @else if (error()) {
        <lf-empty-state
          icon="error_outline"
          title="Couldn't load relationships"
          i18n-title="@@clients.relationshipGraph.loadErrorTitle"
          ctaLabel="Retry"
          i18n-ctaLabel="@@clients.relationshipGraph.retryCta"
          (cta)="load()"
        />
      } @else if (nodes().length === 0 && !addingNew()) {
        <lf-empty-state
          icon="hub"
          title="No relationships recorded"
          i18n-title="@@clients.relationshipGraph.emptyTitle"
          message="Family members, corporate group links, and referrers show up here."
          i18n-message="@@clients.relationshipGraph.emptyMessage"
          ctaLabel="Add relationship"
          i18n-ctaLabel="@@clients.relationshipGraph.addRelationshipButton"
          (cta)="addingNew.set(true)"
        />
      } @else {
        <svg
          [attr.viewBox]="'0 0 ' + CENTER * 2 + ' ' + CENTER * 2"
          class="relationship-graph__svg"
        >
          @for (node of nodes(); track node.id) {
            <line
              [attr.x1]="CENTER"
              [attr.y1]="CENTER"
              [attr.x2]="node.x"
              [attr.y2]="node.y"
              class="relationship-graph__edge"
            />
          }
          <circle
            [attr.cx]="CENTER"
            [attr.cy]="CENTER"
            r="34"
            class="relationship-graph__center-node"
          />
          <text [attr.x]="CENTER" [attr.y]="CENTER" class="relationship-graph__center-label">
            {{ centerLabel() }}
          </text>

          @for (node of nodes(); track node.id) {
            <g
              class="relationship-graph__node"
              [class.relationship-graph__node--clickable]="!!node.relatedClientId"
              (click)="openRelated(node)"
              (keydown.enter)="openRelated(node)"
              [attr.tabindex]="node.relatedClientId ? 0 : -1"
              role="button"
            >
              <circle [attr.cx]="node.x" [attr.cy]="node.y" r="28" />
              <text [attr.x]="node.x" [attr.y]="node.y - 34" class="relationship-graph__edge-label">
                {{ node.relationType }}
              </text>
              <text [attr.x]="node.x" [attr.y]="node.y + 5" class="relationship-graph__node-label">
                {{ node.label }}
              </text>
            </g>
          }
        </svg>

        <button mat-stroked-button type="button" (click)="addingNew.set(true)">
          <span i18n="@@clients.relationshipGraph.addRelationshipButton">Add relationship</span>
        </button>
      }

      @if (addingNew()) {
        <form [formGroup]="form" class="relationship-graph__form">
          <mat-form-field appearance="outline">
            <mat-label i18n="@@clients.relationshipGraph.relationTypeLabel"
              >Relation type</mat-label
            >
            <mat-select formControlName="relationType">
              @for (type of relationTypes; track type) {
                <mat-option [value]="type">{{ type }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@clients.relationshipGraph.relatedClientIdLabel"
              >Related client ID (optional)</mat-label
            >
            <input matInput formControlName="relatedClientId" />
          </mat-form-field>

          <mat-form-field appearance="outline">
            <mat-label i18n="@@clients.relationshipGraph.personNameLabel"
              >Person name (if not a client)</mat-label
            >
            <input matInput formControlName="personName" />
          </mat-form-field>

          @if (formError()) {
            <p class="relationship-graph__error" role="alert">{{ formError() }}</p>
          }

          <div class="relationship-graph__form-actions">
            <button
              mat-button
              type="button"
              (click)="cancelAdd()"
              i18n="@@clients.relationshipGraph.cancelButton"
            >
              Cancel
            </button>
            <button
              mat-flat-button
              color="primary"
              type="button"
              (click)="submit()"
              i18n="@@clients.relationshipGraph.saveButton"
            >
              Save
            </button>
          </div>
        </form>
      }
    </div>
  `,
  styles: `
    .relationship-graph {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: var(--lf-space-2);
    }

    .relationship-graph__svg {
      width: 100%;
      max-width: 480px;
      height: auto;
    }

    .relationship-graph__edge {
      stroke: var(--lf-on-surface-variant);
      stroke-width: 1;
    }

    .relationship-graph__center-node {
      fill: var(--lf-primary, #3f51b5);
    }

    .relationship-graph__center-label {
      text-anchor: middle;
      dominant-baseline: middle;
      fill: white;
      font-size: 11px;
      font-weight: 600;
    }

    .relationship-graph__node circle {
      fill: var(--lf-surface-variant);
      stroke: var(--lf-on-surface-variant);
      stroke-width: 1;
    }

    .relationship-graph__node--clickable {
      cursor: pointer;
    }

    .relationship-graph__node-label,
    .relationship-graph__edge-label {
      text-anchor: middle;
      font-size: 10px;
      fill: var(--lf-on-surface);
    }

    .relationship-graph__edge-label {
      fill: var(--lf-on-surface-variant);
      font-style: italic;
    }

    .relationship-graph__form {
      display: flex;
      flex-direction: column;
      gap: var(--lf-space-1);
      width: 100%;
      max-width: 360px;
    }

    .relationship-graph__form-actions {
      display: flex;
      justify-content: flex-end;
      gap: var(--lf-space-1);
    }

    .relationship-graph__error {
      margin: 0;
      color: var(--lf-error);
      font-size: var(--lf-text-sm);
    }
  `,
})
export class RelationshipGraphComponent {
  private readonly clientsService = inject(ClientsService);
  private readonly router = inject(Router);

  readonly client = input.required<Client>();
  readonly relationTypes = CLIENT_RELATIONSHIP_TYPES;
  readonly CENTER = CENTER;

  readonly loading = signal(true);
  readonly error = signal(false);
  readonly relationships = signal<ClientRelationship[]>([]);
  readonly addingNew = signal(false);
  readonly formError = signal<string | null>(null);

  readonly centerLabel = computed(() => this.client().displayName ?? 'This client');

  readonly nodes = computed<GraphNode[]>(() => {
    const items = this.relationships();
    const count = items.length;
    return items.map((relationship, index) => {
      const angle = (2 * Math.PI * index) / Math.max(count, 1) - Math.PI / 2;
      return {
        id: relationship.id,
        label: relationship.personName ?? `Client ${relationship.relatedClientId?.slice(0, 8)}`,
        relationType: relationship.relationType,
        relatedClientId: relationship.relatedClientId,
        x: CENTER + RADIUS * Math.cos(angle),
        y: CENTER + RADIUS * Math.sin(angle),
      };
    });
  });

  readonly form = new FormGroup({
    relationType: new FormControl<ClientRelationshipType>('Referrer', { nonNullable: true }),
    relatedClientId: new FormControl('', { nonNullable: true }),
    personName: new FormControl('', { nonNullable: true }),
  });

  constructor() {
    this.load();
  }

  load(): void {
    this.loading.set(true);
    this.error.set(false);
    this.clientsService.listRelationships(this.client().id).subscribe({
      next: (relationships) => {
        this.relationships.set(relationships);
        this.loading.set(false);
      },
      error: () => {
        this.error.set(true);
        this.loading.set(false);
      },
    });
  }

  openRelated(node: GraphNode): void {
    if (node.relatedClientId) {
      this.router.navigate(['/clients', node.relatedClientId]);
    }
  }

  cancelAdd(): void {
    this.addingNew.set(false);
    this.formError.set(null);
    this.form.reset({ relationType: 'Referrer', relatedClientId: '', personName: '' });
  }

  submit(): void {
    const value = this.form.getRawValue();
    if (!value.relatedClientId.trim() && !value.personName.trim()) {
      this.formError.set('Enter either a related client ID or a person name.');
      return;
    }
    this.formError.set(null);

    this.clientsService
      .addRelationship(this.client().id, {
        relationType: value.relationType,
        relatedClientId: value.relatedClientId.trim() || null,
        personName: value.personName.trim() || null,
      })
      .subscribe({
        next: (relationship) => {
          this.relationships.update((items) => [...items, relationship]);
          this.cancelAdd();
        },
        error: () => this.formError.set('Something went wrong. Please try again.'),
      });
  }
}
