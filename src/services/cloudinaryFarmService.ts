// Uploads a farm cover photo and returns its URL plus the public id needed to
// delete it later.
export const uploadFarmImageAsync = async (
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
            "farmgate_farmcover"
        );

        const response = await fetch(
            "https://api.cloudinary.com/v1_1/dc9jkdgaf/image/upload",
            {
                method: "POST",
                body: data,
            }
        );

        const file = await response.json();

        return {
            imageUrl: file.secure_url,
            publicId: file.public_id,
        };

    } catch (error) {
        console.log(error);
        throw error;
    }
};