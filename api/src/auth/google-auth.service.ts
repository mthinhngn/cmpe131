import { Injectable, ServiceUnavailableException, UnauthorizedException } from "@nestjs/common";
import { createHash, timingSafeEqual } from "node:crypto";
import { OAuth2Client } from "google-auth-library";
import { UsersService } from "./users.service";
import { AuthService, emailAddress, hashToken, newToken } from "./auth.service";

export function googleSettings() {
  const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET?.trim();
  if (!clientId?.endsWith(".apps.googleusercontent.com") || !clientSecret) throw new ServiceUnavailableException("Google sign-in is not configured yet.");
  let origin: URL;
  try { origin = new URL(process.env.AUTH_WEB_ORIGIN || "http://localhost:5175"); }
  catch { throw new ServiceUnavailableException("Google sign-in return address is not configured."); }
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  if (origin.username || origin.password || origin.pathname !== "/" || origin.search || origin.hash ||
      (process.env.NODE_ENV === "production" ? origin.protocol !== "https:" || local || !(process.env.WEB_ORIGIN || "").split(",").includes(origin.origin) : !local || !["http:", "https:"].includes(origin.protocol))) {
    throw new ServiceUnavailableException("Google sign-in return address is not approved.");
  }
  return { clientId, clientSecret, origin: origin.origin, redirectUri: new URL("/api/v1/auth/google/callback", origin).href };
}

export const googleStateCookie = () => process.env.NODE_ENV === "production" ? "__Host-cr_google_state" : "cr_google_state";
export function googleCookieState(cookie: unknown) {
  if (typeof cookie !== "string") return undefined;
  const prefix = `${googleStateCookie()}=`;
  const value = cookie.split(";").map(part => part.trim()).find(part => part.startsWith(prefix))?.slice(prefix.length);
  return value && /^[a-f0-9]{64}$/.test(value) ? value : undefined;
}

@Injectable()
export class GoogleAuthService {
  constructor(private readonly users: UsersService, private readonly auth: AuthService) {}
  private readonly verifier = new OAuth2Client();
  async start() {
    const settings = googleSettings(), state = newToken(), nonce = newToken(), verifier = newToken();
    await this.users.googleLoginAttempt.deleteMany({ where: { expiresAt: { lte: new Date() } } });
    await this.users.googleLoginAttempt.create({ data: { stateHash: hashToken(state), nonce, verifier, expiresAt: new Date(Date.now() + 10 * 60_000) } });
    const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
    url.search = new URLSearchParams({ client_id: settings.clientId, redirect_uri: settings.redirectUri, response_type: "code", scope: "openid email profile", state, nonce, prompt: "select_account", code_challenge: createHash("sha256").update(verifier).digest("base64url"), code_challenge_method: "S256" }).toString();
    return { url: url.href, state };
  }
  async finish(query: { state?: unknown; code?: unknown; error?: unknown }, cookie: unknown) {
    const settings = googleSettings(), browserState = googleCookieState(cookie);
    if (typeof query.state !== "string" || !/^[a-f0-9]{64}$/.test(query.state) || !browserState || !timingSafeEqual(Buffer.from(query.state), Buffer.from(browserState))) {
      throw new UnauthorizedException("Google sign-in expired or belongs to another browser. Try again.");
    }
    const stateHash = hashToken(query.state);
    // Consume before contacting Google, including denied requests; callbacks cannot be replayed.
    const attempt = await this.users.$transaction(async tx => {
      const value = await tx.googleLoginAttempt.findUnique({ where: { stateHash } });
      if (!value || value.expiresAt <= new Date()) throw new UnauthorizedException("Google sign-in expired. Try again.");
      const used = await tx.googleLoginAttempt.deleteMany({ where: { stateHash, expiresAt: { gt: new Date() } } });
      if (used.count !== 1) throw new UnauthorizedException("Google sign-in was already used. Try again.");
      return value;
    });
    if (query.error !== undefined) throw new UnauthorizedException("Google sign-in was canceled. You can try again.");
    if (typeof query.code !== "string" || !query.code || query.code.length > 4096) throw new UnauthorizedException("Google did not return a valid sign-in code.");
    let payload;
    try {
      const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ client_id: settings.clientId, client_secret: settings.clientSecret, redirect_uri: settings.redirectUri, grant_type: "authorization_code", code: query.code, code_verifier: attempt.verifier }),
        signal: AbortSignal.timeout(10000), redirect: "error",
      });
      if (!response.ok) throw new Error("Token exchange failed");
      const tokens = await response.json() as { id_token?: unknown };
      if (typeof tokens.id_token !== "string") throw new Error("Missing identity token");
      const ticket = await this.verifier.verifyIdToken({ idToken: tokens.id_token, audience: settings.clientId });
      payload = ticket.getPayload();
    } catch {
      // Provider responses and tokens must never reach browser errors or application logs.
      throw new UnauthorizedException("Google sign-in could not be verified. Please try again.");
    }
    if (!payload || payload.nonce !== attempt.nonce || payload.email_verified !== true || !payload.sub || payload.sub.length > 255) throw new UnauthorizedException("Google did not verify this account. Please try again.");
    const email = emailAddress(payload.email);
    return this.auth.googleSignIn({ subject: payload.sub, email, name: payload.name, authoritativeEmail: email.endsWith("@gmail.com") || !!payload.hd });
  }
}
