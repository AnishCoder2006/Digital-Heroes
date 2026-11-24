import { describe, expect, it } from "vitest";
import {
  deriveEncryptionKey,
  deriveIndexKey,
  encryptDonorData,
  decryptDonorData,
  generateSearchToken,
  extractDonorKeywords,
  generateDonorSearchTokens,
  type DonorData,
} from "@/lib/encryption";

describe("Workstream 2: Searchable Encryption & Key Derivation", () => {
  const masterKeyHex = "a1b2c3d4e5f60718293a4b5c6d7e8f90a1b2c3d4e5f60718293a4b5c6d7e8f90";
  const masterKeyBuf = Buffer.from(masterKeyHex, "hex");

  describe("Key derivation (HKDF)", () => {
    it("derives distinct 32-byte keys for AES encryption and HMAC indexing", () => {
      const encKey = deriveEncryptionKey(masterKeyBuf);
      const indexKey = deriveIndexKey(masterKeyBuf);

      expect(encKey).toBeInstanceOf(Buffer);
      expect(indexKey).toBeInstanceOf(Buffer);
      expect(encKey.length).toBe(32);
      expect(indexKey.length).toBe(32);
      expect(encKey.equals(indexKey)).toBe(false);
    });

    it("derives deterministic keys given the same master key", () => {
      const encKey1 = deriveEncryptionKey(masterKeyBuf);
      const encKey2 = deriveEncryptionKey(masterKeyBuf);
      expect(encKey1.toString("hex")).toBe(encKey2.toString("hex"));
    });
  });

  describe("AES-256-GCM authenticated encryption", () => {
    const donor: DonorData = {
      fullName: "Priya Sharma",
      email: "priya.sharma@example.com",
    };

    it("successfully performs an encryption and decryption round-trip", () => {
      const encKey = deriveEncryptionKey(masterKeyBuf);
      const encrypted = encryptDonorData(donor, encKey);

      expect(encrypted.ciphertext).toBeDefined();
      expect(encrypted.nonce).toBeDefined();
      expect(encrypted.nonce.length).toBe(24); // 12 bytes = 24 hex characters

      const decrypted = decryptDonorData(encrypted, encKey);
      expect(decrypted.fullName).toBe("Priya Sharma");
      expect(decrypted.email).toBe("priya.sharma@example.com");
    });

    it("ensures ciphertext does not contain plain donor name or email", () => {
      const encKey = deriveEncryptionKey(masterKeyBuf);
      const encrypted = encryptDonorData(donor, encKey);

      const rawCipher = Buffer.from(encrypted.ciphertext, "hex").toString("utf8");
      expect(rawCipher.includes("Priya")).toBe(false);
      expect(rawCipher.includes("Sharma")).toBe(false);
      expect(rawCipher.includes("example.com")).toBe(false);
    });

    it("fails with authentication error when ciphertext is tampered with", () => {
      const encKey = deriveEncryptionKey(masterKeyBuf);
      const encrypted = encryptDonorData(donor, encKey);

      // Flip one character in the ciphertext
      const originalHex = encrypted.ciphertext;
      const flippedHex =
        (originalHex[0] === "a" ? "b" : "a") + originalHex.slice(1);

      expect(() => {
        decryptDonorData({ ciphertext: flippedHex, nonce: encrypted.nonce }, encKey);
      }).toThrow();
    });

    it("fails when nonce is tampered with", () => {
      const encKey = deriveEncryptionKey(masterKeyBuf);
      const encrypted = encryptDonorData(donor, encKey);

      const flippedNonce =
        (encrypted.nonce[0] === "0" ? "1" : "0") + encrypted.nonce.slice(1);

      expect(() => {
        decryptDonorData({ ciphertext: encrypted.ciphertext, nonce: flippedNonce }, encKey);
      }).toThrow();
    });

    it("fails when decrypted with the wrong key", () => {
      const key1 = deriveEncryptionKey(masterKeyBuf);
      const key2 = Buffer.alloc(32, 99);
      const encrypted = encryptDonorData(donor, key1);

      expect(() => {
        decryptDonorData(encrypted, key2);
      }).toThrow();
    });
  });

  describe("Keyword tokenization & HMAC search index", () => {
    const donor: DonorData = {
      fullName: "Anmol Golf Hero",
      email: "anmol.hero@test.org",
    };

    it("extracts comprehensive, lower-cased keyword tokens from donor details", () => {
      const keywords = extractDonorKeywords(donor);
      expect(keywords).toContain("anmol");
      expect(keywords).toContain("golf");
      expect(keywords).toContain("hero");
      expect(keywords).toContain("anmol golf hero");
      expect(keywords).toContain("anmol.hero@test.org");
      expect(keywords).toContain("test.org");
    });

    it("generates deterministic HMAC search tokens for identical keywords regardless of casing", () => {
      const indexKey = deriveIndexKey(masterKeyBuf);

      const token1 = generateSearchToken("Anmol", indexKey);
      const token2 = generateSearchToken("anmol", indexKey);
      const token3 = generateSearchToken("  ANMOL  ", indexKey);

      expect(token1).toBe(token2);
      expect(token2).toBe(token3);
      expect(token1.length).toBe(64); // SHA-256 hex
    });

    it("generates distinct tokens for different keywords", () => {
      const indexKey = deriveIndexKey(masterKeyBuf);
      const tokenA = generateSearchToken("golf", indexKey);
      const tokenB = generateSearchToken("cricket", indexKey);

      expect(tokenA).not.toBe(tokenB);
    });

    it("generates search tokens for donor record indexing", () => {
      const indexKey = deriveIndexKey(masterKeyBuf);
      const tokens = generateDonorSearchTokens(donor, indexKey);

      expect(tokens.length).toBeGreaterThan(3);
      const searchTokenForHero = generateSearchToken("hero", indexKey);
      expect(tokens).toContain(searchTokenForHero);
    });
  });
});
