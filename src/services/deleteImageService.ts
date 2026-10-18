// Deletes a Cloudinary image through the backend, because the Cloudinary
// credentials only live on the server.
const BACKEND_URL = String(
  process.env.EXPO_PUBLIC_BACKEND_URL || ""
).replace(/\/+$/, "");

// Asks the backend to delete one image by its public id. Failures are only
// logged, so a failed delete never blocks the screen the user is on.
export const deleteCloudinaryImage =
  async (publicId: string) => {

    try {

      if (!BACKEND_URL) {
        console.log(
          "DELETE IMAGE ERROR:",
          "EXPO_PUBLIC_BACKEND_URL is not configured."
        );
        return;
      }

      const response =
        await fetch(
          `${BACKEND_URL}/delete-image`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              public_id: publicId,
            }),
          }
        );

      const data =
        await response.json();

      console.log(
        "DELETE IMAGE RESPONSE:",
        data
      );

    } catch (error) {

      console.log(
        "DELETE IMAGE ERROR:",
        error
      );

    }

};