/**
 * Criptografia simétrica AES-256-GCM para segredos sensíveis armazenados no banco
 * (credenciais SGP, tokens de canal, etc.).
 *
 * Chave: variável de ambiente SGP_ENCRYPTION_KEY (64 hex chars = 32 bytes).
 * Gere com: openssl rand -hex 32
 *
 * Formato armazenado: "enc:v1:<iv_hex>:<ciphertext_hex>"
 * Strings que não começam com "enc:v1:" são tratadas como plaintext (retrocompatibilidade).
 */

import crypto from "node:crypto";

const ALGO = "aes-256-gcm";
const PREFIX = "enc:v1:";

function getKey(): Buffer | null {
  const hex = process.env.SGP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) return null;
  return Buffer.from(hex, "hex");
}

/** Criptografa um valor string. Retorna plaintext se a chave não estiver configurada. */
export function encryptField(plaintext: string): string {
  const key = getKey();
  if (!key) return plaintext; // sem chave: armazena sem cripto (aviso em log)

  const iv = crypto.randomBytes(12); // 96-bit IV para GCM
  const cipher = crypto.createCipheriv(ALGO, key, iv) as crypto.CipherGCM;
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // iv (12B) + tag (16B) + ciphertext — tudo em hex
  return PREFIX + iv.toString("hex") + ":" + tag.toString("hex") + ":" + encrypted.toString("hex");
}

/** Descriptografa um valor. Passa-through se não estiver no formato criptografado. */
export function decryptField(value: string): string {
  if (!value.startsWith(PREFIX)) return value; // plaintext legado

  const key = getKey();
  if (!key) throw new Error("SGP_ENCRYPTION_KEY não configurada — não é possível descriptografar segredos.");

  const parts = value.slice(PREFIX.length).split(":");
  if (parts.length !== 3) throw new Error("Formato de campo criptografado inválido.");
  const [ivHex, tagHex, ctHex] = parts;
  const iv = Buffer.from(ivHex, "hex");
  const tag = Buffer.from(tagHex, "hex");
  const ct = Buffer.from(ctHex, "hex");

  const decipher = crypto.createDecipheriv(ALGO, key, iv) as crypto.DecipherGCM;
  decipher.setAuthTag(tag);
  return decipher.update(ct).toString("utf8") + decipher.final("utf8");
}

/** Criptografa os campos sensíveis de uma config SGP antes de persistir. */
export function encryptSgpConfig(config: Record<string, string>): Record<string, string> {
  if (!getKey()) {
    console.warn("[security] SGP_ENCRYPTION_KEY não definida — credenciais armazenadas sem criptografia.");
    return config;
  }
  const sensitive: (keyof typeof config)[] = ["token", "password"];
  const out = { ...config };
  for (const k of sensitive) {
    if (out[k]) out[k] = encryptField(out[k]);
  }
  return out;
}

/** Descriptografa os campos sensíveis de uma config SGP após carregar do banco. */
export function decryptSgpConfig(config: Record<string, string>): Record<string, string> {
  const sensitive: (keyof typeof config)[] = ["token", "password"];
  const out = { ...config };
  for (const k of sensitive) {
    if (out[k]) {
      try {
        out[k] = decryptField(out[k]);
      } catch {
        // Se falhar a descriptografia (chave trocada), não quebra — loga e segue.
        console.error(`[security] Falha ao descriptografar campo SGP "${k}".`);
      }
    }
  }
  return out;
}
