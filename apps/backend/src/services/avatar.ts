import { randomUUID } from 'crypto';
import { prisma } from '../db/prisma';
import { FileKind, FileStatus } from '@prisma/client';
import { createPresignedUpload, headObject, copyObject, deleteObject } from './s3';
import { env } from '../config/env';

const MAX_AVATAR_BYTES = 2 * 1024 * 1024;
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

function validateAvatarInput(mimeType: string, sizeBytes: number) {
  if (sizeBytes > MAX_AVATAR_BYTES) {
    throw new Error('AVATAR_TOO_LARGE');
  }
  if (!ALLOWED_MIME_TYPES.includes(mimeType)) {
    throw new Error('AVATAR_INVALID_TYPE');
  }
  if (mimeType.includes('svg')) {
    throw new Error('AVATAR_INVALID_TYPE');
  }
}

export async function issueAvatarUpload(params: {
  userId: string;
  mimeType: string;
  sizeBytes: number;
}) {
  validateAvatarInput(params.mimeType, params.sizeBytes);

  const objectKey = `avatars/${params.userId}/${randomUUID()}`;

  const file = await prisma.file.create({
    data: {
      ownerUserId: params.userId,
      kind: FileKind.avatar,
      bucket: env.s3Bucket,
      objectKey,
      mimeType: params.mimeType,
      sizeBytes: params.sizeBytes,
      status: FileStatus.pending
    }
  });

  const uploadUrl = await createPresignedUpload({
    bucket: env.s3Bucket,
    key: objectKey,
    contentType: params.mimeType,
    contentLength: params.sizeBytes,
    expiresInSeconds: env.s3PresignPutTtlSeconds
  });

  return { file, uploadUrl };
}

async function markFileDeleted(fileId: string, deletedKey?: string) {
  const data: { status: FileStatus; deletedAt: Date; objectKey?: string } = {
    status: FileStatus.deleted,
    deletedAt: new Date()
  };
  if (deletedKey) {
    data.objectKey = deletedKey;
  }
  await prisma.file.update({
    where: { id: fileId },
    data
  });
}

async function purgePendingObject(params: { bucket: string; key: string }) {
  try {
    await deleteObject({ bucket: params.bucket, key: params.key });
  } catch {
    // Best-effort cleanup
  }
}

async function moveOldAvatar(params: { bucket: string; key: string; userId: string }) {
  const newKey = `avatars/old/${params.userId}/${randomUUID()}`;
  await copyObject({ bucket: params.bucket, sourceKey: params.key, destinationKey: newKey });
  await deleteObject({ bucket: params.bucket, key: params.key });
  return newKey;
}

export async function confirmAvatarUpload(params: { userId: string; fileId: string }) {
  const file = await prisma.file.findFirst({
    where: {
      id: params.fileId,
      ownerUserId: params.userId,
      kind: FileKind.avatar
    }
  });

  if (!file || file.status !== FileStatus.pending) {
    throw new Error('AVATAR_FILE_INVALID');
  }

  let head;
  try {
    head = await headObject({ bucket: file.bucket, key: file.objectKey });
  } catch {
    await markFileDeleted(file.id);
    throw new Error('AVATAR_FILE_MISSING');
  }

  const contentLength = head.contentLength ?? 0;
  const contentType = head.contentType ?? '';

  if (contentLength > MAX_AVATAR_BYTES) {
    await purgePendingObject({ bucket: file.bucket, key: file.objectKey });
    await markFileDeleted(file.id);
    throw new Error('AVATAR_TOO_LARGE');
  }

  if (!ALLOWED_MIME_TYPES.includes(contentType) || contentType.includes('svg')) {
    await purgePendingObject({ bucket: file.bucket, key: file.objectKey });
    await markFileDeleted(file.id);
    throw new Error('AVATAR_INVALID_TYPE');
  }

  if (file.mimeType !== contentType) {
    await purgePendingObject({ bucket: file.bucket, key: file.objectKey });
    await markFileDeleted(file.id);
    throw new Error('AVATAR_INVALID_TYPE');
  }

  const user = await prisma.user.findUnique({ where: { id: params.userId } });
  if (!user) {
    throw new Error('USER_NOT_FOUND');
  }

  const previousAvatarId = user.avatarFileId;

  await prisma.$transaction(async (tx) => {
    await tx.file.update({
      where: { id: file.id },
      data: { status: FileStatus.active }
    });
    await tx.user.update({
      where: { id: params.userId },
      data: { avatarFileId: file.id }
    });
  });

  if (previousAvatarId && previousAvatarId !== file.id) {
    const previousFile = await prisma.file.findUnique({ where: { id: previousAvatarId } });
    if (previousFile) {
      try {
        const newKey = await moveOldAvatar({
          bucket: previousFile.bucket,
          key: previousFile.objectKey,
          userId: params.userId
        });
        await markFileDeleted(previousFile.id, newKey);
      } catch {
        await markFileDeleted(previousFile.id);
      }
    }
  }

  return file;
}
