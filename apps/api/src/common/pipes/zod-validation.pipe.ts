import type { ArgumentMetadata, PipeTransform } from "@nestjs/common";
import { BadRequestException, Injectable } from "@nestjs/common";
import type { ZodSchema } from "zod";

/**
 * Zod validation pipe — shared schemas from @rentbrown/validation are the
 * single source of truth for request contracts.
 */
@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(private readonly schema: ZodSchema) {}

  transform(value: unknown, _metadata: ArgumentMetadata) {
    const result = this.schema.safeParse(value);
    if (!result.success) {
      throw new BadRequestException({
        code: "VALIDATION_FAILED",
        message: "Request validation failed",
        details: result.error.issues.map((i) => ({
          path: i.path.join("."),
          message: i.message,
        })),
      });
    }
    return result.data;
  }
}
