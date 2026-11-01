import api from "./api";

export const uploadFileToServer = async (file) => {
  if (!file) return;

  const formData = new FormData();
  formData.append("file", file);

  const token = localStorage.getItem("jwt");

  try {
    const res = await api.post("/api/media/upload", formData, {
      headers: {
        "Content-Type": "multipart/form-data",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
    });

    const fileData = res.data;
    console.log("url : ", fileData);
    return fileData.url;
  } catch (error) {
    console.error("error uploading file", error);
  }
};
