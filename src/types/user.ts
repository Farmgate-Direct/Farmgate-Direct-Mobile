// The users collection document, shared by buyers and farmers. Everything past
// the core identity fields only exists on one role, which is why it is optional.
export type UserType = {
  uid: string;

  fullName: string;
  email: string;
  phone: string;
  location?: string;

  // "farmer" or "buyer", plus an approval status such as "pending".
  role: string;
  status: string;

  farmName?: string;
  street?: string;
  barangay?: string;
  municipality?: string;
  province?: string;
  about?: string;

  // Old farm map pin. Delivery is now priced from city and barangay, so these
  // are only kept for documents written before that change.
  farmLat?: number | null;
  farmLng?: number | null;

  coverPhoto?: string;
  // Cloudinary id needed to delete the uploaded image later.
  coverPhotoPublicId?: string;

  profileImage?: string;

  // Cloudinary id needed to delete the uploaded image later.
  profileImagePublicId?: string;
};