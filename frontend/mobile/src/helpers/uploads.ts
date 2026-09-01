import { ApiError, apiFetch } from "./api";

const SCAN_POLL_TRIES = 20;
const SCAN_POLL_MS = 1500;

export const MAX_ATTACHMENT_BYTES = 20 * 1024 * 1024;
export const MAX_ATTACHMENTS = 4;
export const ATTACHMENT_LOCKED_MESSAGE = "Verify your account to attach files to broadcasts";
export const REPLY_MEDIA_LOCKED_MESSAGE = "Verify your account to attach files to replies";

export function canAttachFiles(isVerified: boolean, isAdmin = false): boolean {
  return isAdmin || isVerified;
}

export function isImageAttachment(contentType: string, filename = ""): boolean {
  if (contentType === "image/jpeg" || contentType === "image/png") return true;
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return ext === "jpg" || ext === "jpeg" || ext === "png";
}

const ATTACHMENT_TYPES = new Set([
  "image/jpeg",
  "image/png",
  "application/pdf",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
]);
const ATTACHMENT_EXTS = new Set(["jpg", "jpeg", "png", "pdf", "docx", "xlsx"]);

export type PickedUpload = { uri: string; name: string; type: string };

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function isAllowedAttachment(type: string, name: string): boolean {
  if (ATTACHMENT_TYPES.has(type)) return true;
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return ATTACHMENT_EXTS.has(ext);
}

export async function uploadAvatar(file: PickedUpload): Promise<{ file_id: string; status: string }> {
  const body = new FormData();
  body.append("file", file as unknown as Blob);
  return apiFetch<{ file_id: string; status: string }>("/uploads/avatar", {
    method: "POST",
    body,
  });
}

export async function uploadBroadcastAttachment(
  broadcastId: string,
  file: PickedUpload
): Promise<{ file_id: string; status: string }> {
  const body = new FormData();
  body.append("file", file as unknown as Blob);
  return apiFetch<{ file_id: string; status: string }>(`/uploads/broadcasts/${broadcastId}/attachments`, {
    method: "POST",
    body,
  });
}

export async function getUploadUrl(fileId: string): Promise<{ url: string; thumbnail_url: string | null }> {
  const res = await apiFetch<{ url: string; thumbnail_url?: string | null }>(`/uploads/${fileId}/url`);
  return { url: res.url, thumbnail_url: res.thumbnail_url ?? null };
}

export async function waitForUploadUrl(fileId: string): Promise<string> {
  for (let attempt = 0; attempt < SCAN_POLL_TRIES; attempt += 1) {
    try {
      const urls = await getUploadUrl(fileId);
      return urls.url;
    } catch (error) {
      const waiting = error instanceof ApiError && error.status === 400;
      if (!waiting || attempt === SCAN_POLL_TRIES - 1) throw error;
      await sleep(SCAN_POLL_MS);
    }
  }
  throw new Error("Photo is still being scanned.");
}
