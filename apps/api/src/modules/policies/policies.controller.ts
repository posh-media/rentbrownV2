import {
  BadRequestException,
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Put,
} from "@nestjs/common";
import { ApiTags } from "@nestjs/swagger";
import { setPolicySchema } from "@rentbrown/validation";
import { AdminOnly } from "../../common/decorators/authenticated.decorator.js";
import { CurrentUser } from "../../common/decorators/current-user.decorator.js";
import { ZodValidationPipe } from "../../common/pipes/zod-validation.pipe.js";
import type { InternalUser } from "../users/users.service.js";
import { PoliciesService } from "./policies.service.js";
import { POLICY_SPECS } from "./policies.keys.js";

@ApiTags("admin")
@Controller({ path: "admin/policies", version: "1" })
export class PoliciesController {
  constructor(private readonly policies: PoliciesService) {}

  @Get()
  @AdminOnly("policies.read")
  list() {
    return this.policies.list();
  }

  @Put(":key")
  @AdminOnly("policies.manage")
  async set(
    @Param("key") key: string,
    @Body(new ZodValidationPipe(setPolicySchema)) body: { value: unknown },
    @CurrentUser() actor: InternalUser,
  ) {
    const spec = POLICY_SPECS[key];
    if (!spec) {
      throw new NotFoundException({ code: "POLICY_NOT_FOUND", message: "Unknown policy key" });
    }
    const parsed = spec.schema.safeParse(body.value);
    if (!parsed.success) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Policy value failed validation",
        details: parsed.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    await this.policies.set(key, parsed.data, actor.id);
    return { key, value: parsed.data };
  }
}
