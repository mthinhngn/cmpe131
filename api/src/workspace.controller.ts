import { ForbiddenException, UnauthorizedException, BadRequestException, Body, Controller, Get, Header, Headers, Post, UseGuards } from "@nestjs/common";
import { WorkspaceService } from "./workspace.service";
import { AuthService, profileFields } from "./auth/auth.service";
import { AuthOriginGuard } from "./auth/auth.controller";
import { PrismaService } from "./prisma/prisma.service";
@Controller("workspace")
@UseGuards(AuthOriginGuard)
export class WorkspaceController {
  constructor(private readonly workspaces: WorkspaceService, private readonly auth: AuthService) {}
  private async owner(cookie: unknown, guest: unknown, expected: unknown) {
    const user = await this.auth.current(cookie);
    if ((user && expected !== user.id) || (!user && expected && expected !== "guest")) throw new UnauthorizedException("Account changed in another tab. Reload before editing your workspace.");
    if (user) {
      try { profileFields(user); } catch { throw new ForbiddenException("Complete your profile in Account settings before using your workspace."); }
    }
    // The user database shares exactly the two workspace models; catalog queries stay on PrismaService.
    return user ? { credential: `Bearer ${user.workspaceKey}`, storage: this.auth.users as unknown as PrismaService, major: user.major, startingSemester: user.startingSemester } : { credential: guest, storage: undefined, major: undefined, startingSemester: undefined };
  }
  @Header("Cache-Control", "no-store")
  @Post() async create(@Headers("cookie") cookie: unknown, @Headers("authorization") guest: unknown, @Headers("x-workspace-user") expected: unknown, @Body() body?: { guestState?: unknown }) {
    const owner = await this.owner(cookie, guest, expected);
    return owner.storage ? this.workspaces.create(owner.credential, owner.storage, owner.major) : this.workspaces.guest(body?.guestState);
  }
  @Header("Cache-Control", "no-store")
  @Get() async read(@Headers("cookie") cookie: unknown, @Headers("authorization") guest: unknown, @Headers("x-workspace-user") expected: unknown) {
    const owner = await this.owner(cookie, guest, expected);
    return owner.storage ? this.workspaces.read(owner.credential, owner.storage) : this.workspaces.guest();
  }
  @Header("Cache-Control", "no-store")
  @Post("operations") async execute(@Headers("cookie") cookie: unknown, @Headers("authorization") guest: unknown, @Headers("x-workspace-user") expected: unknown, @Body() body: unknown) {
    const owner = await this.owner(cookie, guest, expected);
    if (!owner.storage) return this.workspaces.executeGuest(body);
    if (owner.storage && (body as { kind?: unknown })?.kind === "importLegacy") throw new BadRequestException("Account workspaces do not import guest data.");
    return this.workspaces.execute(owner.credential, body, owner.storage, owner.startingSemester);
  }
}
