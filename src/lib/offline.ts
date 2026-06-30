export function isOnline(): boolean {
  return navigator.onLine;
}

export function onOnline(callback: () => void): () => void {
  window.addEventListener("online", callback);
  return () => window.removeEventListener("online", callback);
}

export function onOffline(callback: () => void): () => void {
  window.addEventListener("offline", callback);
  return () => window.removeEventListener("offline", callback);
}

export async function waitForOnline(timeoutMs = 30000): Promise<boolean> {
  if (navigator.onLine) return true;
  return new Promise((resolve) => {
    const timeout = setTimeout(() => resolve(false), timeoutMs);
    window.addEventListener("online", () => {
      clearTimeout(timeout);
      resolve(true);
    }, { once: true });
  });
}
