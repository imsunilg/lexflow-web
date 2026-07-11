import { ChangeDetectionStrategy, Component, computed, input, output, signal } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { Folder } from 'shared';

interface TreeNode {
  folder: Folder | null;
  id: string | null;
  name: string;
  depth: number;
  children: TreeNode[];
}

function buildTree(folders: Folder[]): TreeNode {
  const byParent = new Map<string | null, Folder[]>();
  for (const folder of folders) {
    const bucket = byParent.get(folder.parentId) ?? [];
    bucket.push(folder);
    byParent.set(folder.parentId, bucket);
  }

  function build(parentId: string | null, depth: number): TreeNode[] {
    return (byParent.get(parentId) ?? [])
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((folder) => ({
        folder,
        id: folder.id,
        name: folder.name,
        depth,
        children: build(folder.id, depth + 1),
      }));
  }

  return { folder: null, id: null, name: 'Firm root', depth: 0, children: build(null, 1) };
}

/**
 * Folder tree (PRD Module 7 UI Components: "Explorer (tree + list/grid,
 * breadcrumbs, keyboard nav)"). Up/Down move between visible nodes,
 * Left/Right collapse/expand (or move to parent/first child), Enter selects.
 */
@Component({
  selector: 'lf-folder-tree',
  standalone: true,
  imports: [MatIconModule],
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <div class="folder-tree" role="tree">
      @for (row of visibleRows(); track row.node.id ?? 'root') {
        <div
          role="treeitem"
          class="folder-tree__row"
          [class.folder-tree__row--selected]="row.node.id === selectedId()"
          [style.paddingLeft.px]="row.node.depth * 16"
          tabindex="0"
          [attr.aria-selected]="row.node.id === selectedId()"
          (click)="select(row.node)"
          (keydown)="onKeydown($event, row.node)"
        >
          @if (row.node.children.length > 0) {
            <button
              type="button"
              class="folder-tree__toggle"
              (click)="toggle(row.node.id, $event)"
              [attr.aria-label]="expanded().has(row.node.id) ? 'Collapse' : 'Expand'"
            >
              <mat-icon>{{
                expanded().has(row.node.id) ? 'expand_more' : 'chevron_right'
              }}</mat-icon>
            </button>
          } @else {
            <span class="folder-tree__toggle-spacer"></span>
          }
          <mat-icon class="folder-tree__icon">{{
            row.node.id === null ? 'business' : 'folder'
          }}</mat-icon>
          <span class="folder-tree__name">{{ row.node.name }}</span>
        </div>
      }
    </div>
  `,
  styles: `
    .folder-tree {
      display: flex;
      flex-direction: column;
    }

    .folder-tree__row {
      display: flex;
      align-items: center;
      gap: 4px;
      padding: 4px var(--lf-space-1);
      border-radius: 6px;
      cursor: pointer;
      white-space: nowrap;
    }

    .folder-tree__row:hover {
      background: var(--lf-surface-variant);
    }

    .folder-tree__row--selected {
      background: color-mix(in srgb, var(--lf-primary) 14%, transparent);
      color: var(--lf-primary);
      font-weight: 600;
    }

    .folder-tree__toggle {
      display: flex;
      border: none;
      background: none;
      cursor: pointer;
      padding: 0;
      color: inherit;
    }

    .folder-tree__toggle-spacer {
      width: 24px;
      display: inline-block;
    }

    .folder-tree__icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }

    .folder-tree__name {
      overflow: hidden;
      text-overflow: ellipsis;
    }
  `,
})
export class FolderTreeComponent {
  readonly folders = input.required<Folder[]>();
  readonly selectedId = input<string | null>(null);

  readonly folderSelected = output<string | null>();

  readonly expanded = signal<Set<string | null>>(new Set([null]));

  readonly tree = computed(() => buildTree(this.folders()));

  readonly visibleRows = computed(() => {
    const rows: { node: TreeNode }[] = [];
    const walk = (node: TreeNode) => {
      rows.push({ node });
      if (this.expanded().has(node.id) || node.id === null) {
        for (const child of node.children) walk(child);
      }
    };
    walk(this.tree());
    return rows;
  });

  select(node: TreeNode): void {
    this.folderSelected.emit(node.id);
  }

  toggle(id: string | null, event: Event): void {
    event.stopPropagation();
    this.expanded.update((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }

  onKeydown(event: KeyboardEvent, node: TreeNode): void {
    const rows = this.visibleRows();
    const index = rows.findIndex((r) => r.node.id === node.id);

    switch (event.key) {
      case 'ArrowDown': {
        event.preventDefault();
        const next = rows[index + 1];
        if (next) this.focusRow(next.node.id);
        break;
      }
      case 'ArrowUp': {
        event.preventDefault();
        const prev = rows[index - 1];
        if (prev) this.focusRow(prev.node.id);
        break;
      }
      case 'ArrowRight':
        event.preventDefault();
        if (node.children.length > 0 && !this.expanded().has(node.id)) {
          this.expanded.update((current) => new Set(current).add(node.id));
        } else if (node.children.length > 0) {
          this.focusRow(node.children[0].id);
        }
        break;
      case 'ArrowLeft':
        event.preventDefault();
        if (node.children.length > 0 && this.expanded().has(node.id)) {
          this.expanded.update((current) => {
            const next = new Set(current);
            next.delete(node.id);
            return next;
          });
        }
        break;
      case 'Enter':
        event.preventDefault();
        this.select(node);
        break;
    }
  }

  private focusRow(id: string | null): void {
    queueMicrotask(() => {
      const rows = Array.from(document.querySelectorAll<HTMLElement>('[role="treeitem"]'));
      const rowIndex = this.visibleRows().findIndex((r) => r.node.id === id);
      rows[rowIndex]?.focus();
    });
  }
}
