import { Body, Controller, Get, Header, Headers, Post, Res, UseGuards, CanActivate, ExecutionContext, ForbiddenException, Injectable, HttpException } from "@nestjs/common";
import type { Response } from "express";
import { AuthService } from "./auth.service";

@Injectable()
export class AuthOriginGuard implements CanActivate {
  private readonly attempts = new Map<string, { count: number; until: number }>();
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest();
    if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
    const allowed = (process.env.WEB_ORIGIN || "http://localhost:5175,http://127.0.0.1:5175").split(",");
    if (typeof req.headers.origin !== "string" || !allowed.includes(req.headers.origin) || !req.is("application/json")) throw new ForbiddenException("Request must come from the configured Course Radar website.");
    if (/\/auth\/(link|verify)$/.test(req.path)) {
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
  constructor(private readonly auth: AuthService) {}
  @Post("link") @Header("Cache-Control", "no-store")
  link(@Body() body: { email?: unknown } | null) { return this.auth.requestLink(body?.email); }
  @Post("verify") @Header("Cache-Control", "no-store")
  async verify(@Body() body: { token?: unknown } | null, @Res({ passthrough: true }) res: Response) {
    const result = await this.auth.verify(body?.token);
    res.cookie("cr_session", result.session, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/api/v1", maxAge: 30 * 86400_000 });
    return { user: result.user };
  }
  @Get("me") @Header("Cache-Control", "no-store")
  async me(@Headers("cookie") cookie: unknown) { const user = await this.auth.current(cookie); return { user: user ? this.auth.publicUser(user) : null, signInDelivery: this.auth.signInDelivery() }; }
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
