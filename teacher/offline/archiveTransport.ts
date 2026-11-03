const bytes = (text: string) => Uint8Array.from(atob(text), (c) => c.charCodeAt(0));
const base64 = (data: ArrayBuffer | Uint8Array) => {
  const array = new Uint8Array(data instanceof Uint8Array ? data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) : data);
  let value = ''; for (let i = 0; i < array.length; i += 8192) value += String.fromCharCode(...array.subarray(i, i + 8192));
  return btoa(value);
};
async function key(secret: string, salt: Uint8Array) {
  if (secret.length < 12) throw new Error('رمز تسليم الأرشيف يجب أن يكون 12 حرفًا على الأقل.');
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt, hash: 'SHA-256', iterations: 310000 }, material,
    { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
}
export async function encryptArchiveEnvelope(value: unknown, secret: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16)), iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, await key(secret, salt), new TextEncoder().encode(JSON.stringify(value)));
  return { format: 'progtalamid-encrypted-archive-v1', salt: base64(salt), iv: base64(iv), ciphertext: base64(ciphertext) };
}
export async function decryptArchiveEnvelope(value: { format: string; salt: string; iv: string; ciphertext: string }, secret: string) {
  if (value.format !== 'progtalamid-encrypted-archive-v1') throw new Error('صيغة ملف الاستعادة غير معروفة.');
  try {
    const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes(value.iv) }, await key(secret, bytes(value.salt)), bytes(value.ciphertext));
    return JSON.parse(new TextDecoder().decode(plain));
  } catch { throw new Error('تعذر فك الأرشيف؛ تحقق من رمز التسليم وسلامة الملف.'); }
}
