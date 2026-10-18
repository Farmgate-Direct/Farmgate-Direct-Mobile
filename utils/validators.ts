// Accepts a local Philippine mobile number written as 09 followed by 9 digits.
export const isValidPhone = (phone: string) => {
  return /^09\d{9}$/.test(phone);
};

// Turns a local mobile number into the +63 XXX XXX XXXX display format.
export const formatPhilippinePhoneNumber = (phone: string) => {
  const trimmedPhone = phone.trim();
  const digits = trimmedPhone.replace(/\D/g, "");
  // Swap the leading 09 for the 63 country code before grouping the digits.
  const internationalDigits = digits.startsWith("09")
    ? `63${digits.slice(1)}`
    : digits;

  if (!/^639\d{9}$/.test(internationalDigits)) {
    return phone;
  }

  return `+63 ${internationalDigits.slice(2, 5)} ${internationalDigits.slice(5, 8)} ${internationalDigits.slice(8)}`;
};

// Registration only accepts Gmail addresses.
export const isGmail = (email: string) => {
  return /^[a-zA-Z0-9._%+-]+@gmail\.com$/i.test(email);
};

// Shared patterns for email addresses, personal names, and farm names.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const NAME_REGEX = /^[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ .'-]*$/;
const FARM_NAME_REGEX = /^[A-Za-z0-9À-ÿ][A-Za-z0-9À-ÿ .,'&-]*$/;

// Removes any formatting from the phone field and keeps only the 10 digits after +63.
export const sanitizePhoneInput = (value: string) =>
  value.replace(/\D/g, "").replace(/^0+/, "").replace(/^63/, "").slice(0, 10);

// Validates the 10 national digits of a Philippine mobile number.
export const isValidPhPhone = (digits: string) => /^9\d{9}$/.test(digits);

// Builds the full phone number with the +63 country code.
export const toE164Phone = (digits: string) => `+63${digits}`;

// Returns the first problem found in the name, email, and phone fields, or null when all are valid.
export const validateDetails = ({
  fullName,
  email,
  phone,
}: {
  fullName: string;
  email: string;
  phone: string;
}): string | null => {
  const name = fullName.trim();
  if (!name) return "Enter your full name.";
  if (name.length < 2 || name.length > 60 || !NAME_REGEX.test(name))
    return "Full name can only contain letters, spaces, periods, apostrophes, and hyphens.";
  if (!name.includes(" ")) return "Enter both your first and last name.";

  const mail = email.trim();
  if (!mail) return "Enter your email address.";
  if (!EMAIL_REGEX.test(mail))
    return "Invalid email format. Example: juan@gmail.com";
  if (!isGmail(mail)) return "Only Gmail addresses (@gmail.com) are accepted.";

  if (!phone) return "Enter your mobile number.";
  if (!isValidPhPhone(phone))
    return "Enter a valid PH mobile number: 10 digits starting with 9.";
  return null;
};

// Returns a message when the password is too weak or the two passwords do not match.
export const validatePasswords = ({
  password,
  confirmPassword,
}: {
  password: string;
  confirmPassword: string;
}): string | null => {
  if (!password) return "Enter a password.";
  if (password.length < 8) return "Password must be at least 8 characters.";
  if (/\s/.test(password)) return "Password cannot contain spaces.";
  if (!/^[\x21-\x7E]+$/.test(password))
    return "Password cannot contain emojis or special symbols outside the standard keyboard characters.";
  if (!/[A-Za-z]/.test(password) || !/\d/.test(password))
    return "Password must include at least one letter and one number.";
  if (!confirmPassword) return "Confirm your password.";
  if (password !== confirmPassword) return "Passwords do not match.";
  return null;
};

// Returns a message when the farm name, city, or barangay is missing or invalid.
export const validateFarm = ({
  farmName,
  selectedCity,
  selectedBarangay,
}: {
  farmName: string;
  selectedCity: any;
  selectedBarangay: any;
}): string | null => {
  const name = farmName.trim();
  if (!name) return "Enter your farm name.";
  if (name.length < 2 || name.length > 60 || !FARM_NAME_REGEX.test(name))
    return "Farm name has invalid characters or is too short.";
  if (!selectedCity) return "Select your city / municipality.";
  if (!selectedBarangay) return "Select your barangay.";
  return null;
};

// Maps a Firebase or backend error code to a message the user can understand.
export const getRegisterErrorMessage = (code?: string) => {
  switch (code) {
    // The backend email check normally handles this case, so it only shows up when offline.
    case "auth/email-already-in-use":
      return "This email is already in use. If pending approval, please wait. If approved, please sign in instead.";
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
      return "This email is already in use. Sign in with the original password. If pending approval, please wait.";
    case "auth/invalid-email":
      return "Invalid email format.";
    case "auth/weak-password":
      return "Password is too weak. Use at least 8 characters with letters and numbers.";
    case "auth/network-request-failed":
      return "Network error. Check your connection and try again.";
    case "auth/too-many-requests":
      return "Too many attempts. Wait a moment, then try again.";
    case "auth/no-current-user":
      return "Your session expired. Restart registration from Step 1.";
    case "auth/user-token-expired":
      return "Your session expired. Please submit registration again.";
    case "auth/operation-not-allowed":
      return "Email registration is disabled. Please contact support.";
    case "functions/not-found":
    case "functions/internal":
    case "functions/unavailable":
      return "Could not send the verification email. Check your connection and try again.";
    case "valid-id/missing-image":
      return "Upload a clear photo of your valid ID.";
    case "valid-id/upload-failed":
      return "Could not upload your valid ID. Check your connection and try a different image.";
    case "permission-denied":
      return "Could not save your registration. Please try again.";
    default:
      return "We couldn't complete your registration. Please try again.";
  }
};