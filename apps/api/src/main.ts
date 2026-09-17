import "reflect-metadata";
import { NestFactory } from "@nestjs/core";
import { VersioningType } from "@nestjs/common";
import { SwaggerModule, DocumentBuilder } from "@nestjs/swagger";
import helmet from "helmet";
import { AppModule } from "./app.module.js";
import { AppConfigService } from "./config/config.service.js";
import { HttpExceptionFilter } from "./common/filters/http-exception.filter.js";
import { JsonLogger } from "./common/logging/json-logger.js";

async function bootstrap() {
  const logger = new JsonLogger();
  const app = await NestFactory.create(AppModule, {
    logger,
    bufferLogs: true,
  });

  const config = app.get(AppConfigService);

  app.use(helmet());
  app.enableCors({
    origin: config.corsOrigins,
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["content-type", "authorization", "idempotency-key", "x-platform"],
  });

  app.useGlobalFilters(new HttpExceptionFilter(config));

  // URI versioning → /v1/... ; /health stays unversioned for platform probes
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: "1" });

  if (!config.isProd) {
    const doc = new DocumentBuilder()
      .setTitle("RentBrown API")
      .setDescription("RentBrown V2 — property investment platform API")
      .setVersion("0.1.0")
      .addBearerAuth()
      .build();
    const document = SwaggerModule.createDocument(app, doc);
    SwaggerModule.setup("docs", app, document);
  }

  const port = config.get("API_PORT");
  await app.listen(port);
  logger.log(`api listening on :${port} (${config.get("APP_ENV")})`, "Bootstrap");
}

void bootstrap();
