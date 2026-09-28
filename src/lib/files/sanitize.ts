// =====================================================================
//  فحص الملفات المرفوعة وتنظيفها (نقي، بدون مكتبات صور)
//  - تحديد النوع من «البصمة السحرية» للمحتوى لا من اسم الملف
//  - إزالة بيانات EXIF/XMP/IPTC من JPEG والنصوص الوصفية من PNG
//    (صور الشواهد قد تحمل إحداثيات GPS لمكان المستفيد وبيانات الجهاز)
// =====================================================================

export type AllowedMime = "image/jpeg" | "image/png" | "image/webp" | "application/pdf";

export const EXTENSIONS: Record<AllowedMime, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "application/pdf": "pdf",
};

export function sniffMime(buf: Uint8Array): AllowedMime | null {
  const b = buf;
  if (b.length >= 3 && b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return "image/jpeg";
  if (b.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((x, i) => b[i] === x)) return "image/png";
  if (b.length >= 12 && ascii(b, 0, 4) === "RIFF" && ascii(b, 8, 12) === "WEBP") return "image/webp";
  if (b.length >= 5 && ascii(b, 0, 5) === "%PDF-") return "application/pdf";
  return null;
}

const ascii = (b: Uint8Array, s: number, e: number) => String.fromCharCode(...b.subarray(s, e));

/** JPEG: حذف مقاطع APP1 (EXIF/XMP) وAPP13 (IPTC) وCOM، مع إبقاء بيانات الصورة كما هي */
export function stripJpegMetadata(buf: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [buf.subarray(0, 2)]; // SOI
  let i = 2;
  while (i + 4 <= buf.length) {
    if (buf[i] !== 0xff) break; // بنية غير متوقعة: نتوقف ونبقي الباقي
    const marker = buf[i + 1];
    if (marker === 0xda) break; // SOS: بداية بيانات الصورة — ينسخ الباقي كما هو
    const len = (buf[i + 2] << 8) | buf[i + 3];
    const drop = marker === 0xe1 || marker === 0xed || marker === 0xfe;
    if (!drop) out.push(buf.subarray(i, i + 2 + len));
    i += 2 + len;
  }
  out.push(buf.subarray(i));
  return concat(out);
}

/** PNG: حذف مقاطع eXIf وtEXt وzTXt وiTXt وtIME */
export function stripPngMetadata(buf: Uint8Array): Uint8Array {
  const out: Uint8Array[] = [buf.subarray(0, 8)];
  let i = 8;
  while (i + 8 <= buf.length) {
    const len = ((buf[i] << 24) | (buf[i + 1] << 16) | (buf[i + 2] << 8) | buf[i + 3]) >>> 0;
    const type = ascii(buf, i + 4, i + 8);
    const end = i + 12 + len;
    if (end > buf.length) break;
    if (!["eXIf", "tEXt", "zTXt", "iTXt", "tIME"].includes(type)) out.push(buf.subarray(i, end));
    i = end;
    if (type === "IEND") break;
  }
  return concat(out);
}

export function sanitizeUpload(buf: Uint8Array): { mime: AllowedMime; bytes: Uint8Array } | null {
  const mime = sniffMime(buf);
  if (!mime) return null;
  if (mime === "image/jpeg") return { mime, bytes: stripJpegMetadata(buf) };
  if (mime === "image/png") return { mime, bytes: stripPngMetadata(buf) };
  return { mime, bytes: buf };
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((s, p) => s + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}
