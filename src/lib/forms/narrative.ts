// =====================================================================
//  التحقق من النصوص السردية
//  النموذج الرسمي: «تكتب المهارات بطريقة سردية علمية وليس نقاط»
// =====================================================================

/** عدد الكلمات (عربية أو لاتينية أو أرقام) */
export function countWords(text: string | null | undefined): number {
  if (!text) return 0;
  return text.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}

// بداية سطر نقطي: - • * · ▪ ● ◦ ➢ أو ترقيم (1. 1) ١- أ. أ) (1))
const BULLET = /^\s*(?:[-–—•*·▪●◦➢✓√]|\(?[0-9٠-٩]{1,2}[.)\-–]|[أ-ي][.)\-–]\s|\([أ-ي]\))\s*/u;

/** هل النص مكتوب قائمة نقاط؟ (3 أسطر نقطية فأكثر وتشكل نصف الأسطر على الأقل) */
export function looksLikeBulletList(text: string | null | undefined): boolean {
  if (!text) return false;
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const bullets = lines.filter((l) => BULLET.test(l)).length;
  return bullets >= 3 && bullets / lines.length >= 0.5;
}

export interface NarrativeRule {
  minWords: number;
  noBullets?: boolean;
}

/** يعيد رسائل المشكلات (فارغة = سليم) */
export function narrativeIssues(label: string, text: string | null | undefined, rule: NarrativeRule): string[] {
  const issues: string[] = [];
  const words = countWords(text);
  if (words < rule.minWords) issues.push(`${label}: يلزم ${rule.minWords} كلمة على الأقل (الحالي ${words})`);
  if (rule.noBullets && looksLikeBulletList(text)) issues.push(`${label}: يُكتب بأسلوب سردي علمي متصل وليس نقاطاً`);
  return issues;
}
