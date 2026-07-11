import { CalendarItemKind } from 'shared';

export interface CalendarItemStyle {
  icon: string;
  tone: 'info' | 'success' | 'warn' | 'error' | 'neutral';
}

/**
 * Type→icon/tone map for the calendar's "filter layers ... with color coding"
 * (PRD Module 6 User Flow 1). No numeric/semantic mapping is specified in the
 * PRD beyond "color coding," so this assignment is this implementation's own
 * choice, kept consistent with `StatusChipTone` used everywhere else.
 */
const STYLE_BY_KIND: Record<CalendarItemKind, CalendarItemStyle> = {
  Hearing: { icon: 'gavel', tone: 'error' },
  Deadline: { icon: 'event_busy', tone: 'warn' },
  Task: { icon: 'checklist', tone: 'info' },
  Meeting: { icon: 'groups', tone: 'success' },
  Personal: { icon: 'person', tone: 'neutral' },
};

export function calendarItemStyle(kind: CalendarItemKind): CalendarItemStyle {
  return STYLE_BY_KIND[kind];
}
