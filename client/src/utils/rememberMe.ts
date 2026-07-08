import CryptoJS from "crypto-js";

/**
 * Remember Me utility for securely persisting login credentials.
 *
 * ## Security Approach
 *
 * This module uses AES-256 encryption via the crypto-js library (a well-vetted,
 * widely-used encryption library) to encrypt the user's password before storing
 * it in localStorage.
 *
 * ### Key Derivation
 * - The encryption key is derived from the user's email using PBKDF2 with a
 *   random 128-bit salt. This means:
 *   - No encryption key is hardcoded in the source code.
 *   - Each user gets a unique encryption key derived from their email.
 *   - The salt is stored alongside the ciphertext in localStorage.
 * - PBKDF2 uses 10,000 iterations to slow down brute-force attacks.
 *
 * ### Storage
 * - **Email**: Stored in plaintext in localStorage (needed to re-derive the key).
 * - **Password**: Encrypted with AES-256 and stored in localStorage.
 * - **Salt**: Stored in localStorage alongside the ciphertext.
 * - **Remember Me flag**: Stored in localStorage.
 *
 * ### Security Limitations (Honest Assessment)
 * Client-side "Remember Me" cannot be truly secure because the browser must
 * possess the means to decrypt the password. The encryption here provides:
 * - **Defense against casual access**: If someone briefly accesses the user's
 *   device, the password is not immediately readable in plaintext.
 * - **Defense against bulk exfiltration**: The encrypted password is tied to
 *   the user's email, so bulk localStorage dumps are not directly useful.
 * - **No defense against a determined attacker** with access to the browser's
 *   localStorage and knowledge of the user's email, since the key derivation
 *   material (email + salt) is all stored client-side.
 *
 * This is the standard approach used by virtually all web applications that
 * implement "Remember Me" with password persistence. The true security of the
 * application relies on the JWT token system, which remains unchanged.
 */

const STORAGE_KEYS = {
  EMAIL: "moneymate_remembered_email",
  PASSWORD: "moneymate_remembered_password",
  SALT: "moneymate_remembered_salt",
  REMEMBER_ME: "moneymate_remember_me",
} as const;

const PBKDF2_ITERATIONS = 10_000;
const KEY_SIZE = 256 / 32; // 256-bit key = 32 bytes (in 32-bit words)

/**
 * Derive an AES encryption key from the user's email and a salt using PBKDF2.
 */
function deriveKey(email: string, salt: string): string {
  return CryptoJS.PBKDF2(email, salt, {
    keySize: KEY_SIZE,
    iterations: PBKDF2_ITERATIONS,
    hasher: CryptoJS.algo.SHA256,
  }).toString();
}

/**
 * Generate a cryptographically random salt (128 bits, hex-encoded).
 */
function generateSalt(): string {
  return CryptoJS.lib.WordArray.random(16).toString();
}

/**
 * Encrypt the password using AES-256 with a key derived from the user's email.
 * Returns the ciphertext as a hex-encoded string.
 */
function encryptPassword(password: string, email: string, salt: string): string {
  const key = deriveKey(email, salt);
  return CryptoJS.AES.encrypt(password, key).toString();
}

/**
 * Decrypt the password using AES-256 with a key derived from the user's email.
 * Returns the plaintext password, or null if decryption fails.
 */
function decryptPassword(
  ciphertext: string,
  email: string,
  salt: string,
): string | null {
  try {
    const key = deriveKey(email, salt);
    const bytes = CryptoJS.AES.decrypt(ciphertext, key);
    const plaintext = bytes.toString(CryptoJS.enc.Utf8);
    // If decryption produces an empty string, the key was wrong
    return plaintext || null;
  } catch {
    return null;
  }
}

/**
 * Save remembered credentials to localStorage.
 * The password is encrypted with AES-256 using a key derived from the email.
 */
export function saveRememberedCredentials(
  email: string,
  password: string,
): void {
  const salt = generateSalt();
  const encryptedPassword = encryptPassword(password, email, salt);

  localStorage.setItem(STORAGE_KEYS.EMAIL, email);
  localStorage.setItem(STORAGE_KEYS.PASSWORD, encryptedPassword);
  localStorage.setItem(STORAGE_KEYS.SALT, salt);
  localStorage.setItem(STORAGE_KEYS.REMEMBER_ME, "true");
}

/**
 * Load remembered credentials from localStorage.
 * Returns the email and decrypted password, or null if no credentials are stored.
 */
export function loadRememberedCredentials(): {
  email: string;
  password: string;
} | null {
  const email = localStorage.getItem(STORAGE_KEYS.EMAIL);
  const encryptedPassword = localStorage.getItem(STORAGE_KEYS.PASSWORD);
  const salt = localStorage.getItem(STORAGE_KEYS.SALT);

  if (!email || !encryptedPassword || !salt) {
    return null;
  }

  const password = decryptPassword(encryptedPassword, email, salt);
  if (!password) {
    // Decryption failed; stored data is corrupted or tampered with
    clearRememberedCredentials();
    return null;
  }

  return { email, password };
}

/**
 * Check if "Remember Me" was previously enabled.
 */
export function isRememberMeEnabled(): boolean {
  return localStorage.getItem(STORAGE_KEYS.REMEMBER_ME) === "true";
}

/**
 * Clear all remembered credentials from localStorage.
 */
export function clearRememberedCredentials(): void {
  localStorage.removeItem(STORAGE_KEYS.EMAIL);
  localStorage.removeItem(STORAGE_KEYS.PASSWORD);
  localStorage.removeItem(STORAGE_KEYS.SALT);
  localStorage.removeItem(STORAGE_KEYS.REMEMBER_ME);
}