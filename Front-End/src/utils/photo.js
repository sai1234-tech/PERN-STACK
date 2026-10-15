/**
 * Centralized utility to normalize profile and avatar photo URLs across the application.
 * Handles external URLs, blobs, base64 data, and relative paths against the API server.
 */
export function formatPhotoUrl(photo) {
  if (!photo) return "";
  if (photo.startsWith("blob:") || photo.startsWith("data:") || /^https?:\/\//i.test(photo)) {
    return photo;
  }

  const apiUrl = (
    String(import.meta.env.VITE_API_URL || "").replace("localhost", "127.0.0.1") ||
    "http://127.0.0.1:5005/api/v1"
  ).replace(/\/$/, "");

  const cleanPhoto = String(photo).replace(/\\/g, "/").replace(/^\/?api(\/v1)?\/?/, "");
  const baseUrl = apiUrl.replace(/\/api(\/v1)?\/?$/, "");
  return `${baseUrl}${cleanPhoto.startsWith("/") ? cleanPhoto : `/${cleanPhoto}`}`;
}
