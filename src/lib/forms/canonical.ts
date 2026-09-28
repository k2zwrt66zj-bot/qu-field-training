// JSON قانوني (مفاتيح مرتبة) — لتكون بصمة التوقيع مستقلة عن ترتيب الحقول
export function canonicalJson(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(v: unknown): unknown {
  if (Array.isArray(v)) return v.map(sortDeep);
  if (v instanceof Date) return v.toISOString();
  if (v && typeof v === "object") {
    return Object.fromEntries(
      Object.keys(v as object)
        .sort()
        .filter((k) => (v as Record<string, unknown>)[k] !== undefined)
        .map((k) => [k, sortDeep((v as Record<string, unknown>)[k])])
    );
  }
  return v;
}
