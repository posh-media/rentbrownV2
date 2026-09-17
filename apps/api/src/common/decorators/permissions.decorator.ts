import { SetMetadata } from "@nestjs/common";

export const PERMISSIONS_KEY = "required_permissions";

/** e.g. @RequirePermissions("withdrawal.approve", "kyc.review") */
export const RequirePermissions = (...permissions: string[]) =>
  SetMetadata(PERMISSIONS_KEY, permissions);
