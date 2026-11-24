import crypto from "crypto";
import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Workstream 2: Searchable Encryption & Key Derivation Library
 *
 * Cryptographic Scheme:
 * 1. Master Key Derivation:
 *    A single 32-byte secret (`ENC_MASTER_KEY`) in the server environment variable is expanded
 *    using HKDF (RFC 5869) with SHA-256 into two cryptographically independent 256-bit subkeys:
 *      - K_enc: AES-256-GCM encryption key for sensitive donor records.
 *      - K_idx: HMAC-SHA256 key for generating blind keyword search tokens.
 *
 * 2. Authenticated Symmetric Encryption (AES-256-GCM):
 *    - Plaintext: JSON payload containing donor details { fullName, email }.
 *    - IV/Nonce: 12-byte cryptographically secure random value generated per record.
 *    - Authentication Tag: 16 bytes produced by GCM mode. Appended to ciphertext.
 *    - Provides confidentiality (CPA security) and ciphertext integrity (INT-CTXT).
 *      Any modification to ciphertext, nonce, or tag causes decryption failure.
 *
 * 3. Searchable Symmetric Encryption (Deterministic HMAC Indexing):
 *    - A keyword is normalized (lowercased, trimmed).
 *    - Search token T = HMAC-SHA256(K_idx, keyword).
 *    - The database stores (token, contribution_id) tuples without raw keywords.
 *    - Server search turns query 'q' into T_q = HMAC-SHA256(K_idx, q) and performs an exact lookup.
 *
 * Limits & Trade-Offs (vs. He et al. IEEE TCE 2024 Base Paper):
 *    - Equality / Frequency Leakage: Identical keywords produce identical tokens. An adversary observing
 *      the database can infer if multiple records share the same donor name or email domain.
 *    - Exact Match Only: Substring / regex searches cannot be performed without decrypting records.
 *    - Contrast with Base Paper: The base paper uses asymmetric pairing-based Public Key Encryption
 *      with Keyword Search (PEKS) over an Ethereum blockchain. In Semester 5, symmetric HMAC indexing
 *      avoids blockchain gas costs and pairing overhead while maintaining database secrecy.
 */

const HKDF_SALT = "digital_heroes_hkdf_salt_sem5";
const INFO_ENC = "digital_heroes_aes_gcm_encryption_key_v1";
const INFO_INDEX = "digital_heroes_hmac_search_index_key_v1";
const FALLBACK_DEV_MASTER_KEY = "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef";

export interface DonorData {
  fullName: string;
  email: string;
}

export interface EncryptedPayload {
  ciphertext: string; // Combined ciphertext + 16-byte auth tag as hex
  nonce: string;      // 12-byte IV as hex
}

/**
 * Retrieves the raw master key buffer from ENC_MASTER_KEY environment variable.
 */
export function getMasterKey(): Buffer {
  const envKey = process.env.ENC_MASTER_KEY || FALLBACK_DEV_MASTER_KEY;
  if (/^[0-9a-fA-F]{64}$/.test(envKey)) {
    return Buffer.from(envKey, "hex");
  }
  return crypto.createHash("sha256").update(envKey).digest();
}

/**
 * Derives the 32-byte AES-256-GCM encryption key from the master secret using HKDF.
 */
export function deriveEncryptionKey(masterKey?: Buffer): Buffer {
  const mk = masterKey ?? getMasterKey();
  return Buffer.from(
    crypto.hkdfSync("sha256", mk, HKDF_SALT, INFO_ENC, 32)
  );
}

/**
 * Derives the 32-byte HMAC search index key from the master secret using HKDF.
 */
export function deriveIndexKey(masterKey?: Buffer): Buffer {
  const mk = masterKey ?? getMasterKey();
  return Buffer.from(
    crypto.hkdfSync("sha256", mk, HKDF_SALT, INFO_INDEX, 32)
  );
}

/**
 * Encrypts donor information using AES-256-GCM.
 * Nonce is 12 bytes; ciphertext includes the 16-byte authentication tag appended at the end.
 */
export function encryptDonorData(donor: DonorData, encKey?: Buffer): EncryptedPayload {
  const key = encKey ?? deriveEncryptionKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);

  const plaintext = JSON.stringify({
    fullName: donor.fullName.trim(),
    email: donor.email.trim().toLowerCase(),
  });

  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  // Combine ciphertext and 16-byte tag
  const combined = Buffer.concat([encrypted, tag]);

  return {
    ciphertext: combined.toString("hex"),
    nonce: iv.toString("hex"),
  };
}

/**
 * Decrypts donor information using AES-256-GCM.
 * Throws an error if ciphertext or tag was tampered with or if key is invalid.
 */
export function decryptDonorData(payload: EncryptedPayload, encKey?: Buffer): DonorData {
  const key = encKey ?? deriveEncryptionKey();
  const iv = Buffer.from(payload.nonce, "hex");
  const combined = Buffer.from(payload.ciphertext, "hex");

  if (combined.length < 16) {
    throw new Error("Invalid ciphertext: payload too short to contain authentication tag.");
  }

  const ciphertext = combined.subarray(0, combined.length - 16);
  const tag = combined.subarray(combined.length - 16);

  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return JSON.parse(decrypted.toString("utf8")) as DonorData;
}

/**
 * Computes the deterministic HMAC-SHA256 search token for a normalized keyword.
 */
export function generateSearchToken(keyword: string, indexKey?: Buffer): string {
  const key = indexKey ?? deriveIndexKey();
  const normalized = keyword.trim().toLowerCase();
  return crypto.createHmac("sha256", key).update(normalized).digest("hex");
}

/**
 * Extracts searchable keyword tokens from donor details (name and email).
 * Tokenizes name words, full email, email local part, and email domain.
 */
export function extractDonorKeywords(donor: DonorData): string[] {
  const keywords = new Set<string>();

  // Full name words
  if (donor.fullName) {
    const nameWords = donor.fullName
      .trim()
      .toLowerCase()
      .split(/[\s,._-]+/)
      .filter((w) => w.length >= 2);
    for (const word of nameWords) {
      keywords.add(word);
    }
    // Also include the full name as a whole phrase if multi-word
    const cleanFull = donor.fullName.trim().toLowerCase();
    if (cleanFull.length >= 2) {
      keywords.add(cleanFull);
    }
  }

  // Email parts
  if (donor.email) {
    const cleanEmail = donor.email.trim().toLowerCase();
    keywords.add(cleanEmail);

    const [localPart, domainPart] = cleanEmail.split("@");
    if (localPart) {
      keywords.add(localPart);
      const subParts = localPart.split(/[\s,._-]+/).filter((w) => w.length >= 2);
      for (const p of subParts) {
        keywords.add(p);
      }
    }
    if (domainPart) {
      keywords.add(domainPart);
    }
  }

  return Array.from(keywords);
}

/**
 * Generates all search index tokens for a given donor.
 */
export function generateDonorSearchTokens(donor: DonorData, indexKey?: Buffer): string[] {
  const keywords = extractDonorKeywords(donor);
  return keywords.map((kw) => generateSearchToken(kw, indexKey));
}

/**
 * Persists the encrypted donor record and search index tokens to Supabase.
 */
export async function recordEncryptedDonorEntry(
  client: SupabaseClient,
  contributionId: string,
  donor: DonorData,
  keys?: { encKey?: Buffer; indexKey?: Buffer },
): Promise<{ ok: boolean; error?: string }> {
  try {
    const encrypted = encryptDonorData(donor, keys?.encKey);
    const { error: encError } = await client
      .from("donation_records_enc")
      .upsert(
        {
          contribution_id: contributionId,
          ciphertext: encrypted.ciphertext,
          nonce: encrypted.nonce,
        },
        { onConflict: "contribution_id" },
      );

    if (encError) {
      return { ok: false, error: encError.message };
    }

    const tokens = generateDonorSearchTokens(donor, keys?.indexKey);
    if (tokens.length > 0) {
      const rows = tokens.map((token) => ({
        token,
        contribution_id: contributionId,
      }));

      const { error: idxError } = await client
        .from("donation_search_index")
        .upsert(rows, { onConflict: "token,contribution_id" });

      if (idxError) {
        return { ok: false, error: idxError.message };
      }
    }

    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

