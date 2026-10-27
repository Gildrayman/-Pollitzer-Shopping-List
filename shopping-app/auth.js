// Password checks for the login screen and the send-mail step.

// SHA-256 of the family password. Only the hash is kept in the code, so the
// password itself can't be read from the public repository.
export const PASSWORD_HASH = "4d3c81d0207371f8835c36ac47b14d3a7582a537acc3095b0ec88e8aa74dfd2e";

// Plain-JS SHA-256, so the check also works where crypto.subtle is missing
// (for example when the file is opened straight from the phone).
export function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const K = [];
  const H = [];
  const frac = (x) => ((x - Math.floor(x)) * 4294967296) | 0;
  for (let n = 2, found = 0; found < 64; n++) {
    let prime = true;
    for (let d = 2; d * d <= n; d++) if (n % d === 0) { prime = false; break; }
    if (!prime) continue;
    if (found < 8) H.push(frac(Math.pow(n, 1 / 2)));
    K.push(frac(Math.pow(n, 1 / 3)));
    found++;
  }
  const len = bytes.length;
  const padded = new Uint8Array(((len + 9 + 63) >> 6) << 6);
  padded.set(bytes);
  padded[len] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((len * 8) / 4294967296));
  view.setUint32(padded.length - 4, (len * 8) >>> 0);
  const rotr = (x, n) => (x >>> n) | (x << (32 - n));
  const W = new Array(64);
  for (let off = 0; off < padded.length; off += 64) {
    for (let i = 0; i < 16; i++) W[i] = view.getUint32(off + i * 4);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(W[i - 15], 7) ^ rotr(W[i - 15], 18) ^ (W[i - 15] >>> 3);
      const s1 = rotr(W[i - 2], 17) ^ rotr(W[i - 2], 19) ^ (W[i - 2] >>> 10);
      W[i] = (W[i - 16] + s0 + W[i - 7] + s1) | 0;
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let i = 0; i < 64; i++) {
      const t1 = (h + (rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)) + ((e & f) ^ (~e & g)) + K[i] + W[i]) | 0;
      const t2 = ((rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
    }
    H[0] = (H[0] + a) | 0; H[1] = (H[1] + b) | 0; H[2] = (H[2] + c) | 0; H[3] = (H[3] + d) | 0;
    H[4] = (H[4] + e) | 0; H[5] = (H[5] + f) | 0; H[6] = (H[6] + g) | 0; H[7] = (H[7] + h) | 0;
  }
  return H.map((x) => (x >>> 0).toString(16).padStart(8, "0")).join("");
}

// SHA-256 of the separate password asked before an email is sent.
export const SEND_PASSWORD_HASH = "4d3c81d0207371f8835c36ac47b14d3a7582a537acc3095b0ec88e8aa74dfd2e";

export const isSendPassword = (value) => sha256(String(value || "").trim()) === SEND_PASSWORD_HASH;
