import type { Role } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: { id: string; role: Role; mustChangePassword?: boolean } & DefaultSession["user"];
  }
  interface User {
    role: Role;
    mustChangePassword?: boolean;
    /** وقت آخر تغيير لكلمة المرور (ms) */
    passwordChangedAt?: number;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    role: Role;
    /** آخر تحقق من حالة الحساب في القاعدة (ثوانٍ منذ 1970) */
    checkedAt?: number;
    /** كلمة مرور مؤقتة: يُحوَّل المستخدم لتغييرها */
    mustChangePassword?: boolean;
    /** وقت تغيير كلمة المرور المعروف لهذه الجلسة (ms) — تغييره من جهاز آخر يُنهيها */
    pwdAt?: number;
  }
}
