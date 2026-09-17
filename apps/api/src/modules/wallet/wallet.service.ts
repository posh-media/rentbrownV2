import { Inject, Injectable } from "@nestjs/common";
import { eq } from "drizzle-orm";
import { schema, type Database } from "@rentbrown/database";
import type { SupabaseIdentity } from "../../common/supabase/jwt-verifier.js";
import { DB } from "../../database/database.module.js";
import { UsersService } from "../users/users.service.js";

const { walletAccounts } = schema;

@Injectable()
export class WalletService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly users: UsersService,
  ) {}

  /**
   * Phase 1 read-only projection: returns wallet account rows as
   * { currency, type, balanceMinor } — the client only ever sees
   * server-computed state. Reserved/available splits arrive with the
   * ledger writer in a later phase.
   */
  async summary(identity: SupabaseIdentity) {
    const user = await this.users.findOrProvision(identity);
    const accounts = await this.db
      .select()
      .from(walletAccounts)
      .where(eq(walletAccounts.userId, user.id));

    return {
      displayCurrency: user.displayCurrency,
      accounts: accounts.map((a) => ({
        currency: a.currency,
        type: a.type,
        balanceMinor: a.balanceMinor.toString(), // bigint → string, never a float
      })),
    };
  }
}
