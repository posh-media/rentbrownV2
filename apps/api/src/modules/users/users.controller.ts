import { Body, Controller, Get, Patch } from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import type { MeDto, NotificationPrefs, UserDto } from "@rentbrown/types";
import { updateProfileSchema, type UpdateProfileInput } from "@rentbrown/validation";
import { Authenticated } from "../../common/decorators/authenticated.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import { LegalService } from "../legal/legal.service.js";
import { RolesService } from "../rbac/roles.service.js";
import { UsersService, type InternalUser } from "./users.service.js";

export function toUserDto(user: InternalUser): UserDto {
  return {
    id: user.id,
    externalSubject: user.externalSubject,
    email: user.email,
    displayName: user.displayName,
    username: user.username,
    referralCode: user.referralCode,
    accountCurrency: user.accountCurrency,
    displayCurrency: user.displayCurrency,
    accountStatus: user.accountStatus,
    createdAt: user.createdAt.toISOString(),
  };
}

@ApiTags("users")
@Controller({ path: "users", version: "1" })
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly rolesService: RolesService,
    private readonly legal: LegalService,
  ) {}

  /** returns the internal user record, provisioning it on first call */
  @Get("me")
  @Authenticated()
  async me(@CurrentUser() user: InternalUser): Promise<MeDto> {
    return this.toMeDto(user);
  }

  @Patch("me")
  @Authenticated()
  async updateMe(
    @CurrentUser() user: InternalUser,
    @Body(new ZodValidationPipe(updateProfileSchema)) body: UpdateProfileInput,
  ): Promise<MeDto> {
    const updated = await this.users.updateProfile(user.id, body);
    return this.toMeDto(updated);
  }

  /**
   * capabilities are derived server-side — Phase 2 has no financial mutations
   * yet, so withdrawal is honestly reported as unavailable rather than hidden.
   */
  private async toMeDto(user: InternalUser): Promise<MeDto> {
    const [roles, permissions, pendingConsents] = await Promise.all([
      this.rolesService.rolesFor(user.id),
      this.rolesService.permissionsFor(user.id),
      this.legal.pendingFor(user.id),
    ]);
    return {
      ...toUserDto(user),
      firstName: user.firstName,
      lastName: user.lastName,
      phone: user.phone,
      timezone: user.timezone,
      notificationPrefs: (user.notificationPrefs as NotificationPrefs) ?? {},
      emailVerifiedAt: user.emailVerifiedAt?.toISOString() ?? null,
      roles,
      permissions: [...permissions],
      pendingConsents,
      // KYC placeholder — next milestone fills real status/tier/caseId
      kyc: { status: "NONE", tier: 0 },
      capabilities: {
        withdrawal: { allowed: false, reason: "NOT_AVAILABLE_YET" },
        "kyc.start": { allowed: true },
      },
    };
  }
}
