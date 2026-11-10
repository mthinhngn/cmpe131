/** One API base for catalog requests, including deployed frontends. */
export function apiEndpoint(path: string): string {
  const base = (import.meta.env.VITE_API_URL || "/api/v1").replace(/\/+$/, "");
  return `${base}/${path.replace(/^\/+/, "")}`;
}

export async function accountResponse(response: Response) {
  let result;
  try { result = await response.json(); }
  catch { throw new Error("Account service returned an invalid response. Check that the API is running and the website's API proxy is configured, then retry."); }
  if (!response.ok) throw new Error(typeof result?.message === "string" ? result.message : "Account service unavailable. Please retry.");
  return result;
}
