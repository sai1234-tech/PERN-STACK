import crypto from "crypto";
import pool from "../config/db.js";

/**
 * Enterprise In-Memory Sliding Window Rate Limiter
 * Provides rate limiting protection against DDoS, credential stuffing, and API scraping.
 */
const rateLimitMap = new Map();
const WINDOW_MS = 60 * 1000; // 1 minute window
const MAX_REQUESTS_PER_WINDOW = 600; // 600 requests per minute per IP

export const rateLimiter = (req, res, next) => {
  const clientIp = req.headers["x-forwarded-for"] || req.socket.remoteAddress || "127.0.0.1";
  const now = Date.now();

  let clientRecord = rateLimitMap.get(clientIp);
  if (!clientRecord) {
    clientRecord = {
      windowStart: now,
      requestCount: 1,
    };
    rateLimitMap.set(clientIp, clientRecord);
  } else {
    if (now - clientRecord.windowStart > WINDOW_MS) {
      clientRecord.windowStart = now;
      clientRecord.requestCount = 1;
    } else {
      clientRecord.requestCount += 1;
    }
  }

  const remaining = Math.max(0, MAX_REQUESTS_PER_WINDOW - clientRecord.requestCount);
  const resetInSeconds = Math.ceil((clientRecord.windowStart + WINDOW_MS - now) / 1000);

  res.setHeader("X-RateLimit-Limit", MAX_REQUESTS_PER_WINDOW);
  res.setHeader("X-RateLimit-Remaining", remaining);
  res.setHeader("X-RateLimit-Reset", resetInSeconds);

  if (clientRecord.requestCount > MAX_REQUESTS_PER_WINDOW) {
    res.setHeader("Retry-After", resetInSeconds);
    return res.status(429).json({
      success: false,
      message: "Too Many Requests: API rate limit exceeded. Please retry after cooldown.",
      retryAfterSeconds: resetInSeconds,
    });
  }

  next();
};

/**
 * Enterprise HTTP Security Headers Middleware
 * Protects against XSS, clickjacking, MIME-sniffing, and enforces TLS HSTS.
 */
export const securityHeaders = (req, res, next) => {
  res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains; preload");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("X-XSS-Protection", "1; mode=block");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader(
    "Content-Security-Policy",
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline' fonts.googleapis.com; font-src 'self' fonts.gstatic.com; img-src 'self' data: https:;"
  );
  next();
};

/**
 * Cryptographic Helper for Data-At-Rest Encryption / Decryption using AES-256-GCM
 */
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || "enterprise_aes256_key_32chars_hrms!"; // 32 bytes
const IV_LENGTH = 12; // Standard for AES-GCM

export const encryptField = (plaintext) => {
  if (!plaintext) return plaintext;
  const iv = crypto.randomBytes(IV_LENGTH);
  const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  let encrypted = cipher.update(String(plaintext), "utf8", "hex");
  encrypted += cipher.final("hex");
  const authTag = cipher.getAuthTag().toString("hex");
  return `ENC:${iv.toString("hex")}:${authTag}:${encrypted}`;
};

export const decryptField = (cipherText) => {
  if (!cipherText || typeof cipherText !== "string" || !cipherText.startsWith("ENC:")) {
    return cipherText;
  }
  try {
    const parts = cipherText.split(":");
    if (parts.length !== 4) return cipherText;
    const iv = Buffer.from(parts[1], "hex");
    const authTag = Buffer.from(parts[2], "hex");
    const encryptedHex = parts[3];
    const key = crypto.createHash("sha256").update(ENCRYPTION_KEY).digest();
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encryptedHex, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (err) {
    console.error("Decryption failure:", err.message);
    return "[DECRYPTION_ERROR]";
  }
};

/**
 * Masking helper for restricted field-level data
 */
export const applyFieldMasking = (fieldName, rawValue, maskingType = "LAST_4_VISIBLE") => {
  if (rawValue === null || rawValue === undefined || rawValue === "") return "";
  const str = String(rawValue).trim();

  switch (maskingType) {
    case "LAST_4_VISIBLE":
      if (str.length <= 4) return "****";
      return `${"*".repeat(str.length - 4)}${str.slice(-4)}`;

    case "FIRST_2_LAST_2":
      if (str.length <= 4) return "****";
      return `${str.slice(0, 2)}${"*".repeat(str.length - 4)}${str.slice(-2)}`;

    case "CURRENCY_MASK":
      return "₹ **,**,***";

    case "FULL_MASK":
    default:
      return "**********";
  }
};

/**
 * Cryptographic Audit Trail Chaining Helper
 * Adds a tamper-evident SHA-256 hashed entry linked to the previous block's hash.
 */
export const recordChainedAudit = async ({
  action,
  entityType = "GENERAL",
  entityId = "",
  actorId = null,
  actorName = "Security Officer",
  actorRole = "admin",
  details = "",
  beforeState = {},
  afterState = {},
  ipAddress = "127.0.0.1",
  userAgent = "PERN Security Engine",
}) => {
  try {
    // Get the latest block in the immutable audit trail
    const latestRes = await pool.query(
      "SELECT sequence_number, curr_hash FROM immutable_audit_trail ORDER BY sequence_number DESC LIMIT 1"
    );

    let nextSequence = 1;
    let prevHash = "0000000000000000000000000000000000000000000000000000000000000000";

    if (latestRes.rows.length > 0) {
      nextSequence = parseInt(latestRes.rows[0].sequence_number, 10) + 1;
      prevHash = latestRes.rows[0].curr_hash;
    }

    const payloadToHash = JSON.stringify({
      sequenceNumber: nextSequence,
      prevHash,
      action,
      entityType,
      entityId,
      actorName,
      details,
      timestamp: new Date().toISOString(),
    });

    const currHash = crypto.createHash("sha256").update(payloadToHash).digest("hex");

    const insertRes = await pool.query(
      `
      INSERT INTO immutable_audit_trail (
        sequence_number, prev_hash, curr_hash, action, entity_type, entity_id,
        actor_id, actor_name, actor_role, details, before_state, after_state,
        ip_address, user_agent
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *;
    `,
      [
        nextSequence,
        prevHash,
        currHash,
        action,
        entityType,
        String(entityId),
        actorId,
        actorName,
        actorRole,
        details,
        JSON.stringify(beforeState),
        JSON.stringify(afterState),
        ipAddress,
        userAgent,
      ]
    );

    return insertRes.rows[0];
  } catch (err) {
    console.error("Critical error recording chained audit:", err);
    return null;
  }
};
