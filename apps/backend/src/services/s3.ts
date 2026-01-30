import {
  S3Client,
  PutObjectCommand,
  HeadObjectCommand,
  HeadBucketCommand,
  CopyObjectCommand,
  DeleteObjectCommand,
  GetObjectCommand
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../config/env';

type HeadResult = { contentType: string | undefined; contentLength: number | undefined };

type TestObject = {
  contentType: string;
  contentLength: number;
  body?: Buffer;
};

const testStore = new Map<string, TestObject>();

function storeKey(bucket: string, key: string) {
  return `${bucket}/${key}`;
}

const endpoint =
  env.s3Endpoint.startsWith('http://') || env.s3Endpoint.startsWith('https://')
    ? env.s3Endpoint
    : `${env.s3UseSsl ? 'https' : 'http'}://${env.s3Endpoint}`;

const s3 = new S3Client({
  region: env.s3Region,
  endpoint,
  credentials: {
    accessKeyId: env.s3AccessKeyId,
    secretAccessKey: env.s3SecretAccessKey
  },
  forcePathStyle: env.s3ForcePathStyle
});

export async function createPresignedUpload(params: {
  bucket: string;
  key: string;
  contentType: string;
  contentLength?: number;
  expiresInSeconds: number;
}) {
  if (env.isTest) {
    testStore.set(storeKey(params.bucket, params.key), {
      contentType: params.contentType,
      contentLength: params.contentLength ?? 0
    });
    return `https://s3.test.local/${params.bucket}/${params.key}?expires=${params.expiresInSeconds}`;
  }

  const command = new PutObjectCommand({
    Bucket: params.bucket,
    Key: params.key,
    ContentType: params.contentType,
    ...(typeof params.contentLength === 'number' ? { ContentLength: params.contentLength } : {})
  });

  return getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds });
}

export async function headObject(params: { bucket: string; key: string }): Promise<HeadResult> {
  if (env.isTest) {
    const entry = testStore.get(storeKey(params.bucket, params.key));
    if (!entry) {
      throw new Error('OBJECT_NOT_FOUND');
    }
    return { contentType: entry.contentType, contentLength: entry.contentLength };
  }

  const response = await s3.send(
    new HeadObjectCommand({
      Bucket: params.bucket,
      Key: params.key
    })
  );

  return { contentType: response.ContentType, contentLength: response.ContentLength };
}

export async function createPresignedDownload(params: {
  bucket: string;
  key: string;
  expiresInSeconds: number;
}) {
  if (env.isTest) {
    return `https://s3.test.local/${params.bucket}/${params.key}?signed=true&expires=${params.expiresInSeconds}`;
  }

  const command = new GetObjectCommand({
    Bucket: params.bucket,
    Key: params.key
  });

  return getSignedUrl(s3, command, { expiresIn: params.expiresInSeconds });
}

export async function putObject(params: {
  bucket: string;
  key: string;
  body: Buffer;
  contentType: string;
}) {
  if (env.isTest) {
    testStore.set(storeKey(params.bucket, params.key), {
      contentType: params.contentType,
      contentLength: params.body.length,
      body: params.body
    });
    return;
  }

  await s3.send(
    new PutObjectCommand({
      Bucket: params.bucket,
      Key: params.key,
      Body: params.body,
      ContentType: params.contentType
    })
  );
}

export async function copyObject(params: {
  bucket: string;
  sourceKey: string;
  destinationKey: string;
}) {
  if (env.isTest) {
    const entry = testStore.get(storeKey(params.bucket, params.sourceKey));
    if (!entry) {
      throw new Error('OBJECT_NOT_FOUND');
    }
    const next: TestObject = {
      contentType: entry.contentType,
      contentLength: entry.contentLength
    };
    if (entry.body) {
      next.body = entry.body;
    }
    testStore.set(storeKey(params.bucket, params.destinationKey), next);
    return;
  }

  await s3.send(
    new CopyObjectCommand({
      Bucket: params.bucket,
      CopySource: `${params.bucket}/${params.sourceKey}`,
      Key: params.destinationKey
    })
  );
}

export async function deleteObject(params: { bucket: string; key: string }) {
  if (env.isTest) {
    testStore.delete(storeKey(params.bucket, params.key));
    return;
  }

  await s3.send(
    new DeleteObjectCommand({
      Bucket: params.bucket,
      Key: params.key
    })
  );
}

export async function checkS3Connection(): Promise<{ ok: boolean; latencyMs: number | null; error?: string }> {
  if (env.isTest) {
    return { ok: true, latencyMs: 0 };
  }

  const start = Date.now();
  try {
    await s3.send(
      new HeadBucketCommand({
        Bucket: env.s3Bucket
      })
    );
    return { ok: true, latencyMs: Date.now() - start };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'S3_UNAVAILABLE';
    return { ok: false, latencyMs: Date.now() - start, error: message.slice(0, 160) };
  }
}
