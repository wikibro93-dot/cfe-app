const ALLOWED_IMAGE_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"];
const MAX_IMAGE_BYTES = 5 * 1024 * 1024; // 5 MB

export async function uploadImage(file: File): Promise<string> {
  // Validate before anything leaves the browser. (The server also rejects
  // non-Cloudinary image URLs when a dish is created.)
  if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
    throw new Error("Only JPEG, PNG, WebP or GIF images are allowed");
  }
  if (file.size > MAX_IMAGE_BYTES) {
    throw new Error("Image must be 5 MB or smaller");
  }

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;

  if (!cloudName) {
    throw new Error("Cloudinary not configured");
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", "cfe_dishes");
  formData.append("folder", "cfe/dishes");

  const res = await fetch(
    `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
    { method: "POST", body: formData }
  );

  if (!res.ok) {
    throw new Error("Image upload failed");
  }

  const data = await res.json();
  // Only accept a URL that actually came from our Cloudinary cloud.
  if (
    !data.secure_url ||
    typeof data.secure_url !== "string" ||
    !data.secure_url.startsWith(`https://res.cloudinary.com/${cloudName}/`)
  ) {
    throw new Error("Image upload failed");
  }
  return data.secure_url;
}

export function getOptimizedImageUrl(url: string, width = 400, height = 300): string {
  if (!url || !url.includes("cloudinary.com")) return url;
  return url.replace("/upload/", `/upload/w_${width},h_${height},c_fill,q_auto,f_auto/`);
}
