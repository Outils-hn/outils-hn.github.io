// Mini createur de fichier .zip (sans compression, « stocke ») : suffisant pour des PDF et des images deja compresses.
const TABLE = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
export function crc32(octets) { let c = 0xffffffff; for (let i = 0; i < octets.length; i++) c = TABLE[(c ^ octets[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }

/** fichiers : [{ nom: "dossier/fichier.pdf", octets: Uint8Array }] -> liste de morceaux a mettre dans un Blob */
export function creerZip(fichiers) {
  const enc = new TextEncoder(), morceaux = [], central = [];
  let decalage = 0;
  for (const f of fichiers) {
    const nom = enc.encode(f.nom), crc = crc32(f.octets), taille = f.octets.length;
    const entete = new DataView(new ArrayBuffer(30));
    entete.setUint32(0, 0x04034b50, true); entete.setUint16(4, 20, true); entete.setUint16(6, 0x0800, true); // drapeau 0x0800 = noms en UTF-8
    entete.setUint32(14, crc, true); entete.setUint32(18, taille, true); entete.setUint32(22, taille, true); entete.setUint16(26, nom.length, true);
    morceaux.push(new Uint8Array(entete.buffer), nom, f.octets);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(8, 0x0800, true);
    c.setUint32(16, crc, true); c.setUint32(20, taille, true); c.setUint32(24, taille, true); c.setUint16(28, nom.length, true); c.setUint32(42, decalage, true);
    central.push(new Uint8Array(c.buffer), nom);
    decalage += 30 + nom.length + taille;
  }
  const tailleCentral = central.reduce((s, m) => s + m.length, 0);
  const fin = new DataView(new ArrayBuffer(22));
  fin.setUint32(0, 0x06054b50, true); fin.setUint16(8, fichiers.length, true); fin.setUint16(10, fichiers.length, true);
  fin.setUint32(12, tailleCentral, true); fin.setUint32(16, decalage, true);
  return [...morceaux, ...central, new Uint8Array(fin.buffer)];
}
