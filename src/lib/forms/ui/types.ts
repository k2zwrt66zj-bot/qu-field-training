// أنواع الوصف التصريحي لواجهات النماذج (نقية — تستخدمها الواجهة والاختبارات)
import type { NarrativeRule } from "../narrative.ts";

export interface Option {
  value: string;
  label: string;
}

export interface Column {
  key: string;
  label: string;
  type: "text" | "number" | "prose";
  width?: string;
  readOnly?: boolean;
  placeholder?: string;
}

export type Widget =
  | { type: "text"; placeholder?: string; dir?: "ltr" }
  | { type: "prose"; rule?: NarrativeRule; rows?: number; placeholder?: string }
  | { type: "number"; min?: number; max?: number; suffix?: string }
  | { type: "date" }
  | { type: "time" }
  | { type: "choice"; options: Option[]; layout?: "cards" | "inline" }
  | { type: "multiChoice"; options: Option[] }
  | { type: "yesNo"; yes: string; no: string } // خانات (√) الثنائية في الجداول الرسمية
  | { type: "check"; text: string } // علامة (√) منفردة
  | { type: "consent"; text: string } // إقرار يجب قبوله
  | { type: "list"; max: number; itemPlaceholder?: string; addLabel?: string }
  | { type: "rows"; columns: Column[]; max: number; addLabel?: string; fixedRows?: boolean }
  | { type: "weekday" } // يوم التدريب الثابت
  | { type: "caseStudyRef" } // ربط المقابلة بدراسة حالة للطالب نفسه
  | { type: "readonly" }; // حقل يملؤه النظام

export interface FieldSpec {
  key: string;
  label: string;
  hint?: string;
  widget: Widget;
  /** عرض كامل السطر */
  wide?: boolean;
  /** يظهر الحقل فقط عند تحقق الشرط (مثل: أسئلة الإنهاء المخطط) */
  when?: (data: Record<string, unknown>) => boolean;
}

export interface SectionSpec {
  id: string;
  title: string;
  description?: string;
  fields: FieldSpec[];
}

export interface FormSpec {
  sections: SectionSpec[];
  /** عنوان قسم المرفقات إن كان النموذج الرسمي يتضمنه */
  evidenceTitle?: string;
}
