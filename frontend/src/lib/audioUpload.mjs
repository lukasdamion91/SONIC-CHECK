// Decimal megabytes, shared with the API upload contract: 100 MB = 100,000,000 bytes.
export const MAX_AUDIO_UPLOAD_BYTES = 100_000_000;
export const AUDIO_UPLOAD_LIMIT_LABEL = "100 MB";

export function audioUploadValidationError(file) {
  if (!file) return "";
  if (!Number.isSafeInteger(file.size) || file.size < 0) {
    return "The audio file size could not be read. Choose the file again.";
  }
  if (file.size === 0) return "This audio file is empty. Choose another file.";
  if (file.size > MAX_AUDIO_UPLOAD_BYTES) {
    return `This audio file exceeds the ${AUDIO_UPLOAD_LIMIT_LABEL} limit. Choose a smaller file.`;
  }
  return "";
}
