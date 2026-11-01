import { uploadFileToServer } from "./uploadFile";

export const uploadToCloudinary = async (pics) => {
  if (!pics) return null;
  const cloud_name = "dxoqwusir";
  try {
    const data = new FormData();
    data.append("file", pics);
    data.append("upload_preset", "ml_default");
    data.append("cloud_name", cloud_name);

    const res = await fetch(
      `https://api.cloudinary.com/v1_1/${cloud_name}/image/upload`,
      { method: "post", body: data }
    );
    if (!res.ok) throw new Error("Cloudinary upload failed");
    const fileData = await res.json();
    return fileData.url;
  } catch (err) {
    console.warn("Cloudinary không khả dụng, chuyển sang lưu ảnh tại Backend local:", err);
    return await uploadFileToServer(pics);
  }
};
