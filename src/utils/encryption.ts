/**
 * وحدة التشفير الآمنة
 * تستخدم Web Crypto API (مدمج في المتصفح)
 */

const ENCRYPTION_KEY = 'BGA-STUDENT-MANAGEMENT-SECURE-KEY-2025';

/**
 * تشفير البيانات
 */
export async function encryptData(data: any): Promise<string> {
  try {
    const jsonString = JSON.stringify(data);
    const encoder = new TextEncoder();
    const dataBuffer = encoder.encode(jsonString);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const salt = crypto.getRandomValues(new Uint8Array(16));
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt']
    );

    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encryptedBuffer = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      dataBuffer
    );

    const resultBuffer = new Uint8Array(
      salt.length + iv.length + encryptedBuffer.byteLength
    );
    resultBuffer.set(salt, 0);
    resultBuffer.set(iv, salt.length);
    resultBuffer.set(new Uint8Array(encryptedBuffer), salt.length + iv.length);

    return btoa(String.fromCharCode(...resultBuffer));
  } catch (error) {
    console.error('خطأ في التشفير:', error);
    throw new Error('فشل تشفير البيانات');
  }
}

/**
 * فك تشفير البيانات
 */
export async function decryptData(encryptedData: string): Promise<any> {
  try {
    const encoder = new TextEncoder();
    const decoder = new TextDecoder();

    const resultBuffer = new Uint8Array(
      atob(encryptedData)
        .split('')
        .map(c => c.charCodeAt(0))
    );

    const salt = resultBuffer.slice(0, 16);
    const iv = resultBuffer.slice(16, 28);
    const encryptedBuffer = resultBuffer.slice(28);

    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(ENCRYPTION_KEY),
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );

    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv },
      key,
      encryptedBuffer
    );

    const jsonString = decoder.decode(decryptedBuffer);
    return JSON.parse(jsonString);
  } catch (error) {
    console.error('خطأ في فك التشفير:', error);
    throw new Error('فشل فك تشفير البيانات');
  }
}

/**
 * حفظ بيانات مشفرة في localStorage
 */
export async function setEncryptedItem(key: string, data: any): Promise<void> {
  const encrypted = await encryptData(data);
  localStorage.setItem(key, encrypted);
}

/**
 * قراءة بيانات مشفرة من localStorage
 */
export async function getEncryptedItem(key: string): Promise<any | null> {
  const encrypted = localStorage.getItem(key);
  if (!encrypted) return null;

  try {
    return await decryptData(encrypted);
  } catch {
    localStorage.removeItem(key);
    return null;
  }
}

/**
 * حذف بيانات من localStorage
 */
export function removeEncryptedItem(key: string): void {
  localStorage.removeItem(key);
}
