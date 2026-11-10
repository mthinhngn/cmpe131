import { Body, Controller, Get, Header, Headers, Post, Query, Res, UseGuards, CanActivate, ExecutionContext, ForbiddenException, Injectable, HttpException } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";
import { GoogleAuthService, googleSettings, googleStateCookie } from "./google-auth.service";

const sessionOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/api/v1", maxAge: 30 * 86400_000 });
const googleCookieOptions = () => ({ httpOnly: true, sameSite: "lax" as const, secure: process.env.NODE_ENV === "production", path: "/" });

@Injectable()
export class AuthOriginGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    const allowed = (process.env.WEB_ORIGIN || "http://localhost:5175,http://127.0.0.1:5175").split(",");
    if (typeof req.headers.origin !== "string" || !allowed.includes(req.headers.origin) || !req.is("application/json")) throw new ForbiddenException("Request must come from the configured Course Radar website.");
    if (/\/auth\/(google\/start)$/.test(req.path)) {
      const now = Date.now();
      for (const [key, value] of this.attempts) if (value.until <= now) this.attempts.delete(key);
      const key = req.ip || "local";
      const attempt = this.attempts.get(key) || { count: 0, until: now + 60_000 };
      if (this.attempts.size >= 10000 || ++attempt.count > 30) throw new HttpException("Too many sign-in attempts. Wait one minute and try again.", 429);
      this.attempts.set(key, attempt);
    }
    return true;
  }
}

@Controller("auth")
@UseGuards(AuthOriginGuard)
export class AuthController {
  constructor(private readonly auth: AuthService, private readonly google: GoogleAuthService) {}
  @Post("google/start") @Header("Cache-Control", "no-store")
  async googleStart(@Res({ passthrough: true }) res: Response) {
    const attempt = await this.google.start();
    res.cookie(googleStateCookie(), attempt.state, { ...googleCookieOptions(), maxAge: 10 * 60_000 });
    return { url: attempt.url };
  }
  @Get("google/callback") @Header("Cache-Control", "no-store") @Header("Referrer-Policy", "no-referrer")
  async googleCallback(@Query() query: { state?: unknown; code?: unknown; error?: unknown }, @Headers("cookie") cookie: unknown, @Res() res: Response) {
    const { origin } = googleSettings();
    res.clearCookie(googleStateCookie(), googleCookieOptions());
    try {
      const result = await this.google.finish(query, cookie);
      res.cookie("cr_session", result.session, sessionOptions());
      return res.redirect(303, `${origin}/account`);
    } catch {
      // Keep codes, provider errors and credentials out of redirects and logs.
      return res.redirect(303, `${origin}/account?google_error=${query.error === "access_denied" ? "canceled" : "failed"}`);
    }
  }
  @Get("me") @Header("Cache-Control", "no-store")
  async me(@Headers("cookie") cookie: unknown) { const user = await this.auth.current(cookie); return { user: user ? this.auth.publicUser(user) : null }; }
  @Post("profile") @Header("Cache-Control", "no-store")
  async profile(@Headers("cookie") cookie: unknown, @Body() body: unknown) {
    const user = await this.auth.requireUser(cookie);
    return { user: await this.auth.saveProfile(user, body) };
  }
  @Post("logout") @Header("Cache-Control", "no-store")
  async logout(@Headers("cookie") cookie: unknown, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.logout(cookie);
    res.clearCookie("cr_session", { path: "/api/v1", httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production" });
    return result;
  }
}
