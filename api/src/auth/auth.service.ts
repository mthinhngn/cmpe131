import { BadRequestException, Injectable, UnauthorizedException } from "@nestjs/common";
import { createHash, randomBytes } from "node:crypto";
import { PrismaService } from "../prisma/prisma.service";
import { BootstrapController } from "../bootstrap.controller";
import { PlanningStore, type State } from "../planning-engine";
import type { ProgramCatalog } from "../course-types";
import { UsersService } from "./users.service";

export const hashToken = (token: string) => createHash("sha256").update(token).digest("hex");
export const newToken = () => randomBytes(32).toString("hex");
export function emailAddress(value: unknown) {
  if (typeof value !== "string" || value.trim().length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())) throw new BadRequestException("Enter a valid email address.");
  return value.trim().toLowerCase();
}
export function profileFields(body: unknown) {
  const b = body as Record<string, unknown> | null;
  if (!b || typeof b.name !== "string" || !b.name.trim() || b.name.trim().length > 100 || typeof b.major !== "string" || !/^[a-z0-9-]{1,120}$/.test(b.major) || typeof b.startingSemester !== "string" || !/^(Spring|Summer|Fall|Winter) (19\d{2}|20\d{2}|2100)$/.test(b.startingSemester)) throw new BadRequestException("Enter your name, a supported major, and starting semester (for example Fall 2024).");
  return { name: b.name.trim(), major: b.major, startingSemester: b.startingSemester };
}
export function sessionToken(cookie: unknown) {
  if (typeof cookie !== "string") return undefined;
  const token = cookie.split(";").map(p => p.trim()).find(p => p.startsWith("cr_session="))?.slice(11);
  return token && /^[a-f0-9]{64}$/.test(token) ? token : undefined;
}

@Injectable()
export class AuthService {
  constructor(readonly users: UsersService, private readonly catalogDb: PrismaService) {}
  publicUser(user: { id: string; email: string; name: string; major: string; startingSemester: string }) {
    return { id: user.id, email: user.email, name: user.name, major: user.major, startingSemester: user.startingSemester };
  }
  async saveProfile(user: { id: string; workspaceKey: string }, input: unknown) {
    const fields = profileFields(input);
    return this.users.$transaction(async tx => {
      // Serialize profile edits, and commit program selection with the same profile save.
      await tx.$queryRaw`SELECT "id" FROM "User" WHERE "id" = ${user.id} FOR UPDATE`;
      const workspace = await tx.personalWorkspace.findUnique({ where: { tokenHash: hashToken(user.workspaceKey) } });
      if (workspace) {
        await tx.$queryRaw`SELECT "id" FROM "PersonalWorkspace" WHERE "id" = ${workspace.id} FOR UPDATE`;
        const current = await tx.personalWorkspace.findUniqueOrThrow({ where: { id: workspace.id } });
        const before = current.state as unknown as State;
        const additional = (input as any).additionalPrograms ?? before.additionalPrograms?.[fields.major] ?? [];
        const catalog = await new BootstrapController(this.catalogDb).compose(fields.major, additional);
        if (before.program !== fields.major || JSON.stringify(before.additionalPrograms?.[fields.major] ?? []) !== JSON.stringify(additional)) {
          const store = new PlanningStore(before.program, before.catalog);
          store.restore(before);
          store.selectProgram(fields.major, catalog, additional);
          const state = { ...store.getState(), undoRevision: undefined, undoRequestId: undefined };
          await tx.personalWorkspace.update({ where: { id: current.id }, data: { state: JSON.parse(JSON.stringify(state)), version: { increment: 1 } } });
          await tx.personalOperation.create({ data: { workspaceId: current.id, requestId: newToken(), fingerprint: hashToken(JSON.stringify(fields)), kind: "profile-program", before: JSON.parse(JSON.stringify(before)), result: { status: "success", message: "Program saved from Account settings." } } });
        }
      } else {
        const additional = (input as any).additionalPrograms ?? [];
        const catalog = await new BootstrapController(this.catalogDb).compose(fields.major, additional);
        const store = new PlanningStore(fields.major, catalog);
        store.selectProgram(fields.major, catalog, additional);
        await tx.personalWorkspace.create({ data: { tokenHash: hashToken(user.workspaceKey), state: JSON.parse(JSON.stringify(store.getState())) } });
      }
      return this.publicUser(await tx.user.update({ where: { id: user.id }, data: fields }));
    });
  }
  async googleSignIn(identity: { subject: string; email: string; name?: string; authoritativeEmail: boolean }) {
    return this.users.$transaction(async tx => {
      // Match a stable Google subject first; an email change must not create a second account.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${`google:${identity.subject}`}))::text`;
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(hashtext(${identity.email}))::text`;
      let user = await tx.user.findUnique({ where: { googleSubject: identity.subject } });
      if (user && user.email !== identity.email) {
        if (!identity.authoritativeEmail || await tx.user.findUnique({ where: { email: identity.email } })) throw new UnauthorizedException("The updated Google email cannot be linked automatically.");
        user = await tx.user.update({ where: { id: user.id }, data: { email: identity.email } });
      }
      if (!user) {
        const existing = await tx.user.findUnique({ where: { email: identity.email } });
        if (existing?.googleSubject || (existing && !identity.authoritativeEmail)) {
          throw new UnauthorizedException("This email already belongs to an account that cannot be linked automatically. Use its original sign-in method.");
        }
        user = existing
          ? await tx.user.update({ where: { id: existing.id }, data: { googleSubject: identity.subject } })
          : await tx.user.create({ data: { email: identity.email, googleSubject: identity.subject, workspaceKey: newToken(), name: identity.name?.slice(0, 100) || "" } });
      }
      const session = newToken();
      await tx.session.create({ data: { tokenHash: hashToken(session), userId: user.id, expiresAt: new Date(Date.now() + 30 * 86400_000) } });
      return { user: this.publicUser(user), session };
    });
  }
  async current(cookie: unknown) {
    const token = sessionToken(cookie);
    if (!token) return null;
    const session = await this.users.session.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: true } });
    if (!session || session.expiresAt <= new Date()) throw new UnauthorizedException("Your session expired. Sign in again or sign out to continue as a guest.");
    return session.user;
  }
  async requireUser(cookie: unknown) {
    const user = await this.current(cookie);
    if (!user) throw new UnauthorizedException("Sign in to access your account.");
    return user;
  }
  async logout(cookie: unknown) {
    const token = sessionToken(cookie);
    if (token) await this.users.session.deleteMany({ where: { tokenHash: hashToken(token) } });
    return { ok: true };
  }
}
