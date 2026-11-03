const crypto = require('node:crypto');
const fs = require('node:fs/promises');
const path = require('node:path');

function createInstitutionArchiveSigner(directory) {
  let loading;
  const load = () => loading ||= (async () => {
    const filename = path.join(directory, 'attendance-archive-signing-key.json');
    try { return JSON.parse(await fs.readFile(filename, 'utf8')); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
    const pair = crypto.generateKeyPairSync('ec', { namedCurve: 'prime256v1' });
    const data = { keyId: crypto.randomUUID(),
      privatePem: pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), publicJwk: pair.publicKey.export({ format: 'jwk' }) };
    await fs.mkdir(directory, { recursive: true });
    await fs.writeFile(filename, JSON.stringify(data), { flag: 'wx', mode: 0o600 });
    return data;
  })();
  return {
    async publicKey() { const key = await load(); return { keyId: key.keyId, publicJwk: key.publicJwk }; },
    async sign(payload) {
      if (typeof payload !== 'string' || Buffer.byteLength(payload) > 25_000_000) throw new Error('Invalid archive size');
      const parsed = JSON.parse(payload);
      if (parsed.format !== 'progtalamid-teacher-archive-v1' || !Array.isArray(parsed.records)) throw new Error('Invalid archive format');
      const key = await load();
      return { keyId: key.keyId, payload, signature: crypto.sign('sha256', Buffer.from(payload),
        { key: key.privatePem, dsaEncoding: 'ieee-p1363' }).toString('base64url') };
    },
  };
}
module.exports = { createInstitutionArchiveSigner };
