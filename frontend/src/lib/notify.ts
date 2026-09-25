// Thin, safe wrapper over the browser Notification API. Everything is guarded
// for SSR and browsers without support, so callers never need try/catch.
export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function notificationPermission(): NotificationPermission | "unsupported" {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

// Ask the user for permission; returns the resulting state.
export async function enableNotifications(): Promise<NotificationPermission | "unsupported"> {
  if (!notificationsSupported()) return "unsupported";
  if (Notification.permission === "granted") return "granted";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// Show a system notification if (and only if) permission was granted.
export function pushNotification(title: string, body: string): void {
  if (!notificationsSupported() || Notification.permission !== "granted") return;
  try {
    new Notification(title, { body, tag: title });
  } catch {
    // Some browsers require a ServiceWorker for Constructor-based notifications;
    // the in-app toast already fired, so a silent failure here is acceptable.
  }
}
