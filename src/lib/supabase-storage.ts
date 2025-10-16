import type { SupabaseClient } from "@supabase/supabase-js";

type BucketOptions = {
  public?: boolean;
  fileSizeLimit?: string;
  allowedMimeTypes?: string[];
};

/**
 * Ensure that a Supabase storage bucket exists, creating it if necessary.
 * This helper tolerates buckets that already exist and surfaces unexpected errors.
 */
export async function ensureBucketExists(
  client: SupabaseClient,
  bucketId: string,
  options: BucketOptions = { public: true }
) {
  if (!bucketId?.trim()) {
    throw new Error("ensureBucketExists appelé sans identifiant de bucket.");
  }

  const { data: existingBucket, error: fetchError } = await client.storage.getBucket(bucketId);
  if (!fetchError && existingBucket) {
    return;
  }

  const status = (fetchError as { status?: number; statusCode?: number } | null)?.status ??
    (fetchError as { status?: number; statusCode?: number } | null)?.statusCode;
  const isNotFound = status === 404 || /not\s+found/i.test(fetchError?.message ?? "");

  if (fetchError && !isNotFound) {
    throw new Error(
      `Lecture du bucket Supabase "${bucketId}" impossible: ${fetchError.message ?? "erreur inconnue"}.`
    );
  }

  const { error: createError } = await client.storage.createBucket(bucketId, {
    public: true,
    ...options,
  });

  if (createError && !/exists/i.test(createError.message ?? "")) {
    throw new Error(
      `Création du bucket Supabase "${bucketId}" impossible: ${createError.message ?? "erreur inconnue"}.`
    );
  }
}
