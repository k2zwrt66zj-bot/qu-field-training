import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIES, SESSION_MAX_AGE, USE_SECURE_COOKIES, USER_RECHECK_SECONDS } from "./config";
import { safeRelativePath } from "./redirect";
import { LOCKED_ERROR, afterFailedLogin } from "./password-policy";

/** بصمة bcrypt وهمية: زمن الرد متقارب سواء وُجد البريد أم لا (لا يُستدل على الحسابات المسجلة) */
const DUMMY_HASH = "$2a$10$CwTycUXWue0Thq9StjUM0uJ8.QfQ5jY8yBPK2s8nmFJ5Ob0n7xQ1W";

const credentialsSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6),
});

export const authOptions: NextAuthOptions = {
  // جلسة منزلقة لمدة 30 يوماً: كل طلب لـ /api/auth/session (يرسله المتصفح دورياً والصفحة مفتوحة
  // وعند العودة إلى التبويب) يعيد إصدار الكوكي بصلاحية 30 يوماً جديدة، فلا خروج عند الخمول
  session: { strategy: "jwt", maxAge: SESSION_MAX_AGE },
  jwt: { maxAge: SESSION_MAX_AGE },
  useSecureCookies: USE_SECURE_COOKIES,
  cookies: AUTH_COOKIES,
  pages: { signIn: "/login" },
  providers: [
    CredentialsProvider({
      name: "البريد الجامعي",
      credentials: { email: { type: "email" }, password: { type: "password" } },
      async authorize(raw) {
        const parsed = credentialsSchema.safeParse(raw);
        if (!parsed.success) return null;
        const user = await prisma.user.findUnique({ where: { email: parsed.data.email } });
        if (!user || !user.isActive) {
          await bcrypt.compare(parsed.data.password, DUMMY_HASH);
          return null;
        }
        const now = new Date();
        // قفل مؤقت بعد تكرار كلمة المرور الخاطئة (يحمي من تخمين كلمات المرور)
        if (user.lockedUntil && user.lockedUntil > now) throw new Error(LOCKED_ERROR);
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) {
          const next = afterFailedLogin(user.failedLogins, now);
          await prisma.user.update({ where: { id: user.id }, data: next });
          if (next.lockedUntil) {
            await prisma.auditLog.create({ data: { actorId: user.id, action: "auth.locked", entity: "User", entityId: user.id } });
            throw new Error(LOCKED_ERROR);
          }
          return null;
        }
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: now, failedLogins: 0, lockedUntil: null } });
        return {
          id: user.id,
          email: user.email,
          name: user.fullName,
          role: user.role,
          mustChangePassword: user.mustChangePassword,
          passwordChangedAt: user.passwordChangedAt?.getTime() ?? 0,
        };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user, trigger }) {
      const now = Math.floor(Date.now() / 1000);
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.mustChangePassword = user.mustChangePassword;
        token.pwdAt = user.passwordChangedAt;
        token.checkedAt = now;
        return token;
      }
      // مع جلسة طويلة: نتحقق دورياً من الحساب نفسه، فيسري إيقاف الحساب أو تغيير دوره خلال دقائق لا بعد 30 يوماً.
      // trigger === "update": بعد تغيير كلمة المرور من هذا الجهاز (تحديث فوري للجلسة الحالية)
      if (trigger === "update" || !token.checkedAt || now - token.checkedAt >= USER_RECHECK_SECONDS) {
        const current = await prisma.user.findUnique({
          where: { id: token.id },
          select: { isActive: true, role: true, fullName: true, mustChangePassword: true, passwordChangedAt: true },
        });
        // الخطأ هنا يجعل NextAuth يلغي الجلسة ويحذف الكوكي
        if (!current?.isActive) throw new Error("الحساب موقوف أو محذوف — أُنهيت الجلسة");
        const changedAt = current.passwordChangedAt?.getTime() ?? 0;
        // تغيّرت كلمة المرور من جهاز آخر بعد إصدار هذه الجلسة: تُنهى
        if (trigger !== "update" && changedAt > (token.pwdAt ?? 0)) throw new Error("تغيّرت كلمة المرور — أُنهيت الجلسة");
        token.role = current.role;
        token.name = current.fullName;
        token.mustChangePassword = current.mustChangePassword;
        token.pwdAt = changedAt;
        token.checkedAt = now;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.name = token.name;
      session.user.mustChangePassword = !!token.mustChangePassword;
      return session;
    },
    /**
     * إعادة التوجيه دائماً بمسار نسبي (مثل /login) فيبقى المستخدم على نطاق الطلب الحالي،
     * بدل رابط مطلق مبني على NEXTAUTH_URL (http://localhost:3000 مثلاً) عند فتح المنصة من نطاق آخر.
     * ويمنع أيضاً إعادة التوجيه إلى مواقع خارجية.
     */
    async redirect({ url }) {
      return safeRelativePath(url, "/");
    },
  },
};
