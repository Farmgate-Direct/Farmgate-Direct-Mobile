// Uploads a product photo and returns its URL plus the public id needed to
// delete it later.
export const uploadImageAsync = async (
  uri: string
) => {
  try {
    const data = new FormData();

    data.append("file", {
      uri,
      type: "image/jpeg",
      name: "upload.jpg",
    } as any);

    data.append(
      "upload_preset",
      "farmgate_products"
    );

    const response = await fetch(
      "https://api.cloudinary.com/v1_1/dc9jkdgaf/image/upload",
      {
        method: "POST",
        body: data,
      }
    );

    const file = await response.json();
    if (!response.ok || !file.secure_url || !file.public_id) {
      throw new Error(
        file.error?.message || "The image could not be uploaded."
      );
    }

    return {
      imageUrl: file.secure_url,
      publicId: file.public_id,
    };

  } catch (error) {
    console.log(error);
    throw error;
  }
};

// Uploads a product video and returns its URL plus the public id needed to
// delete it later.
export const uploadProductVideoAsync = async (uri: string) => {
  try {
    // Keep the mov format when that is what the picker returned, and treat
    // everything else as mp4.
    const uriExtension = uri
      .split("?")[0]
      .match(/\.([a-z0-9]+)$/i)?.[1]
      ?.toLowerCase();
    const extension = uriExtension === "mov" ? "mov" : "mp4";
    const mimeType =
      extension === "mov" ? "video/quicktime" : "video/mp4";
    const data = new FormData();

    data.append("file", {
      uri,
      type: mimeType,
      name: `product-video.${extension}`,
    } as any);
    data.append("upload_preset", "farmgate_products");

    const response = await fetch(
      "https://api.cloudinary.com/v1_1/dc9jkdgaf/video/upload",
      {
        method: "POST",
        body: data,
      }
    );

    const file = await response.json();
    if (!response.ok || !file.secure_url || !file.public_id) {
      throw new Error(
        file.error?.message || "The video could not be uploaded."
      );
    }

    return {
      videoUrl: file.secure_url,
      publicId: file.public_id,
    };
  } catch (error) {
    console.error("PRODUCT VIDEO UPLOAD ERROR:", error);
    throw error;
  }
};