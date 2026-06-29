/**
 * Object-storage service (MinIO/S3) for visitor-uploaded images (pre-registration selfie + ID).
 * The bytes never ride through the DB — only the storage key lands in `document_record`. MinIO is
 * on the private compose network, so staff browsers never reach it directly; the server proxies
 * bytes back through tRPC as base64 (same approach as the institution logo).
 */
import { TRPCError } from '@trpc/server';
import {
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  type S3ClientConfig,
} from '@aws-sdk/client-s3';
import { env } from '../env.ts';

/** Whether object storage is wired up (endpoint + credentials present). */
export function isStorageConfigured(): boolean {
  return Boolean(env.S3_ENDPOINT && env.S3_ACCESS_KEY && env.S3_SECRET_KEY);
}

let client: S3Client | null = null;
function s3(): S3Client {
  if (!isStorageConfigured()) {
    throw new TRPCError({
      code: 'PRECONDITION_FAILED',
      message: 'Object storage is not configured.',
    });
  }
  if (!client) {
    const config: S3ClientConfig = {
      endpoint: env.S3_ENDPOINT,
      region: env.S3_REGION,
      forcePathStyle: env.S3_FORCE_PATH_STYLE,
      credentials: {
        accessKeyId: env.S3_ACCESS_KEY!,
        secretAccessKey: env.S3_SECRET_KEY!,
      },
    };
    client = new S3Client(config);
  }
  return client;
}

/** Upload bytes to the documents bucket under `key`. */
export async function putObject(key: string, body: Buffer, contentType: string): Promise<void> {
  await s3().send(
    new PutObjectCommand({
      Bucket: env.S3_BUCKET,
      Key: key,
      Body: body,
      ContentType: contentType,
    }),
  );
}

/** Fetch bytes (buffered) from the documents bucket. */
export async function getObject(key: string): Promise<{ body: Buffer; contentType: string }> {
  const res = await s3().send(new GetObjectCommand({ Bucket: env.S3_BUCKET, Key: key }));
  if (!res.Body) {
    throw new TRPCError({ code: 'NOT_FOUND', message: 'Object not found.' });
  }
  const bytes = await res.Body.transformToByteArray();
  return {
    body: Buffer.from(bytes),
    contentType: res.ContentType ?? 'application/octet-stream',
  };
}

const MIME_EXT: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * Validate + decode a base64 `data:` URL, mirroring `setLogo`'s checks. Returns the decoded mime,
 * raw bytes and a file extension; throws a `TRPCError` on a malformed, disallowed or oversized
 * image so the same guarantees hold whether the caller is the logo upload or pre-registration.
 */
export function decodeDataUrl(
  dataUrl: string,
  opts: { allowedMime: readonly string[]; maxBytes: number },
): { mime: string; bytes: Buffer; ext: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(dataUrl);
  const mime = m?.[1]?.toLowerCase();
  const data = m?.[2];
  if (!m || !mime || !data || !opts.allowedMime.includes(mime)) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'Use a JPG, PNG or WebP image.' });
  }
  const bytes = Buffer.from(data, 'base64');
  if (bytes.length === 0) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'The image is empty.' });
  }
  if (bytes.length > opts.maxBytes) {
    throw new TRPCError({ code: 'BAD_REQUEST', message: 'The image is too large.' });
  }
  return { mime, bytes, ext: MIME_EXT[mime] ?? 'bin' };
}
