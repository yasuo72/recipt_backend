const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // bytes for GCM

function getKey() {
  const secret =
    process.env.RECEIPT_ENC_KEY ||
    process.env.JWT_SECRET ||
    'fallback-receipt-secret';
  return crypto.createHash('sha256').update(String(secret)).digest();
}

// Encrypts a UTF-8 string and returns a base64 string in the format
// "iv:ciphertext:tag".
function encrypt(text) {
  const key = getKey();
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(text, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();

  return [
    iv.toString('base64'),
    encrypted.toString('base64'),
    tag.toString('base64'),
  ].join(':');
}

// Decrypts a base64 string in the format "iv:ciphertext:tag".
function decrypt(payload) {
  if (!payload) return '';
  const [ivB64, encryptedB64, tagB64] = payload.split(':');
  if (!ivB64 || !encryptedB64 || !tagB64) return '';

  const key = getKey();
  const iv = Buffer.from(ivB64, 'base64');
  const encrypted = Buffer.from(encryptedB64, 'base64');
  const tag = Buffer.from(tagB64, 'base64');

  const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(tag);
  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

module.exports = { encrypt, decrypt };
