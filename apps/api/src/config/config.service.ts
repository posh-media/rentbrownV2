import { Injectable } from "@nestjs/common";
import { loadConfig, type AppConfig } from "@rentbrown/config";

/** Typed config provider — validated at boot, injected everywhere. */
@Injectable()
export class AppConfigService {
  private readonly config: AppConfig;

  constructor() {
    this.config = loadConfig();
  }

  get<K extends keyof AppConfig>(key: K): AppConfig[K] {
    return this.config[key];
  }

  get corsOrigins(): string[] {
    return this.config.CORS_ORIGINS.split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }

  get isProd(): boolean {
    return this.config.APP_ENV === "production";
  }
}
