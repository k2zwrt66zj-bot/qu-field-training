// =====================================================================
//  تخزين الملفات (المرفقات والأختام) — محوّل قابل للتبديل عبر STORAGE_DRIVER
//   local    : قرص الخادم (STORAGE_DIR، افتراضياً ./storage) — للتطوير والخوادم الخاصة
//   supabase : Supabase Storage عبر REST (حاوية خاصة + مفتاح الخدمة على الخادم فقط)
//  الملفات لا تُقدَّم مباشرة أبداً: تمر عبر /api/attachments/:id بعد فحص الصلاحية
// =====================================================================
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";

export interface StorageAdapter {
  put(key: string, bytes: Uint8Array, mime: string): Promise<void>;
  get(key: string): Promise<Uint8Array>;
  remove(key: string): Promise<void>;
}

const SAFE_KEY = /^[a-zA-Z0-9/_\-.]+$/;
function assertKey(key: string) {
  if (!SAFE_KEY.test(key) || key.includes("..")) throw new Error("مفتاح تخزين غير صالح");
}

class LocalStorage implements StorageAdapter {
  constructor(private root = path.resolve(process.env.STORAGE_DIR ?? "storage")) {}
  private file(key: string) {
    assertKey(key);
    return path.join(this.root, key);
  }
  async put(key: string, bytes: Uint8Array) {
    const f = this.file(key);
    await mkdir(path.dirname(f), { recursive: true });
    await writeFile(f, bytes);
  }
  async get(key: string) {
    return new Uint8Array(await readFile(this.file(key)));
  }
  async remove(key: string) {
    await rm(this.file(key), { force: true });
  }
}

class SupabaseStorage implements StorageAdapter {
  private base = `${process.env.SUPABASE_URL}/storage/v1/object`;
  private bucket = process.env.SUPABASE_BUCKET ?? "field-training";
  private headers = { Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`, apikey: process.env.SUPABASE_SERVICE_ROLE_KEY ?? "" };
  async put(key: string, bytes: Uint8Array, mime: string) {
    assertKey(key);
    const r = await fetch(`${this.base}/${this.bucket}/${key}`, { method: "POST", headers: { ...this.headers, "Content-Type": mime, "x-upsert": "true" }, body: Buffer.from(bytes) });
    if (!r.ok) throw new Error(`Supabase upload failed: ${r.status}`);
  }
  async get(key: string) {
    assertKey(key);
    const r = await fetch(`${this.base}/authenticated/${this.bucket}/${key}`, { headers: this.headers });
    if (!r.ok) throw new Error(`Supabase download failed: ${r.status}`);
    return new Uint8Array(await r.arrayBuffer());
  }
  async remove(key: string) {
    assertKey(key);
    await fetch(`${this.base}/${this.bucket}/${key}`, { method: "DELETE", headers: this.headers });
  }
}

let instance: StorageAdapter | null = null;
export function storage(): StorageAdapter {
  instance ??= process.env.STORAGE_DRIVER === "supabase" ? new SupabaseStorage() : new LocalStorage();
  return instance;
}
