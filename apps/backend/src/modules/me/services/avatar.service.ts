import { confirmAvatarUpload, issueAvatarUpload } from '../../../services/avatar';

export async function issueAvatarUploadForUser(params: {
  userId: string;
  mime_type: string;
  size_bytes: number;
}) {
  return issueAvatarUpload({
    userId: params.userId,
    mimeType: params.mime_type,
    sizeBytes: params.size_bytes
  });
}

export async function confirmAvatarUploadForUser(params: { userId: string; file_id: string }) {
  return confirmAvatarUpload({
    userId: params.userId,
    fileId: params.file_id
  });
}
