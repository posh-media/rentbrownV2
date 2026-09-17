import { ServiceUnavailableException } from "@nestjs/common";
import type { StorageProvider } from "@rentbrown/providers";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AppConfigService } from "../../config/config.service.js";

export const STORAGE_PROVIDER = Symbol("STORAGE_PROVIDER");
export const KYC_PROVIDER = Symbol("KYC_PROVIDER");

export class StorageError extends Error {
  constructor(
    public readonly code: "STORAGE_ERROR" | "STORAGE_NOT_CONFIGURED",
    message: string,
  ) {
    super(message);
    this.name = "StorageError";
  }
}

/**
 * Supabase Storage adapter — private buckets only. Object refs are
 * `bucket/path`; never public URLs. Bucket must be created PRIVATE in the
 * Supabase dashboard ahead of time (see docs/DEPLOYMENT.md) — the adapter
 * never creates buckets or touches bucket policies at runtime.
 */
export class SupabaseStorageProvider implements StorageProvider {
  readonly name = "SUPABASE_STORAGE";

  constructor(private readonly client: SupabaseClient) {}

  static fromConfig(config: AppConfigService): SupabaseStorageProvider {
    const client = createClient(
      config.get("SUPABASE_URL"),
      config.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
    return new SupabaseStorageProvider(client);
  }

  private split(objectRef: string): { bucket: string; path: string } {
    const idx = objectRef.indexOf("/");
    return { bucket: objectRef.slice(0, idx), path: objectRef.slice(idx + 1) };
  }

  async uploadPrivate(
    bucket: string,
    path: string,
    data: Buffer,
    contentType: string,
  ): Promise<string> {
    const { error } = await this.client.storage
      .from(bucket)
      .upload(path, data, { contentType, upsert: false });
    if (error) {
      console.error(JSON.stringify({ level: "error", msg: "storage.upload_failed", bucket }));
      throw new StorageError("STORAGE_ERROR", "storage upload failed");
    }
    return `${bucket}/${path}`;
  }

  async createSignedUrl(objectRef: string, ttlSeconds: number): Promise<string> {
    const { bucket, path } = this.split(objectRef);
    const { data, error } = await this.client.storage
      .from(bucket)
      .createSignedUrl(path, ttlSeconds);
    if (error || !data?.signedUrl) {
      console.error(JSON.stringify({ level: "error", msg: "storage.sign_failed", bucket }));
      throw new StorageError("STORAGE_ERROR", "could not create signed URL");
    }
    return data.signedUrl;
  }

  async delete(objectRef: string): Promise<void> {
    const { bucket, path } = this.split(objectRef);
    const { error } = await this.client.storage.from(bucket).remove([path]);
    if (error) {
      console.error(JSON.stringify({ level: "error", msg: "storage.delete_failed", bucket }));
      throw new StorageError("STORAGE_ERROR", "storage delete failed");
    }
  }
}

export class NotConfiguredStorageProvider implements StorageProvider {
  readonly name = "NOT_CONFIGURED";

  private fail(): never {
    throw new ServiceUnavailableException({
      code: "STORAGE_NOT_CONFIGURED",
      message: "Document storage is not configured",
    });
  }

  uploadPrivate(): Promise<string> {
    return this.fail();
  }
  createSignedUrl(): Promise<string> {
    return this.fail();
  }
  delete(): Promise<void> {
    return this.fail();
  }
}
