import { uploadFileToServer } from "./uploadFile";

export const uploadToCloudinary = async (pics) => {
  if (!pics) return null;

  const cloudName = import.meta.env.VITE_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = import.meta.env.VITE_CLOUDINARY_UPLOAD_PRESET;

  if (cloudName && uploadPreset) {
    try {
      const data = new FormData();
      data.append("file", pics);
      data.append("upload_preset", uploadPreset);
      data.append("cloud_name", cloudName);

      const res = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        { method: "POST", body: data }
      );

      if (!res.ok) throw new Error("Cloudinary upload failed");
      const fileData = await res.json();
      return fileData.secure_url || fileData.url;
    } catch (err) {
      console.warn("Cloudinary không khả dụng, chuyển sang lưu tại Backend:", err);
    }
  }

  return await uploadFileToServer(pics);
};
