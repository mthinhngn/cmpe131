/** One API base for catalog requests, including deployed frontends. */
export function apiEndpoint(path: string): string {
  const base = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}
