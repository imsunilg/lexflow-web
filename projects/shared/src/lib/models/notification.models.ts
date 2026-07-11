/** `GET /notifications` item shape (`NotificationDto`, PRD §22). */
export interface NotificationItem {
  id: string;
  kind: string;
  title: string;
  body: string | null;
  deepLink: string | null;
  readAt: string | null;
  createdAt: string;
}

/** Push payload shape broadcast on the `/hubs/notifications` SignalR hub's `notificationCreated` method — mirrors `NotificationItem` (the hub isn't wired to a real event source yet server-side; this is the documented push contract per PRD §22/§16). */
export type NotificationPushEvent = NotificationItem;
