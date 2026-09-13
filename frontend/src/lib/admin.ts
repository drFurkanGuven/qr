const ADMIN_TOKEN_KEY = "qr_admin_token";

export function getAdminToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return localStorage.getItem(ADMIN_TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setAdminToken(token: string): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(ADMIN_TOKEN_KEY, token);
  notifyAdminAuthChange();
}

export function clearAdminToken(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(ADMIN_TOKEN_KEY);
  notifyAdminAuthChange();
}

export function isAdminLoggedIn(): boolean {
  return !!getAdminToken();
}

export function notifyAdminAuthChange(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("admin-auth-changed"));
}