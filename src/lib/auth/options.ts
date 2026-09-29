import type { NextAuthOptions } from "next-auth";
import CredentialsProvider from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { AUTH_COOKIES, SESSION_MAX_AGE, USE_SECURE_COOKIES, USER_RECHECK_SECONDS } from "./config";
import { safeRelativePath } from "./redirect";

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
        if (!user || !user.isActive) return null;
        const ok = await bcrypt.compare(parsed.data.password, user.passwordHash);
        if (!ok) return null;
        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        return { id: user.id, email: user.email, name: user.fullName, role: user.role };
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      const now = Math.floor(Date.now() / 1000);
      if (user) {
        token.id = user.id;
        token.role = user.role;
        token.checkedAt = now;
        return token;
      }
      // مع جلسة طويلة: نتحقق دورياً من الحساب نفسه، فيسري إيقاف الحساب أو تغيير دوره خلال دقائق لا بعد 30 يوماً
      if (!token.checkedAt || now - token.checkedAt >= USER_RECHECK_SECONDS) {
        const current = await prisma.user.findUnique({ where: { id: token.id }, select: { isActive: true, role: true, fullName: true } });
        // الخطأ هنا يجعل NextAuth يلغي الجلسة ويحذف الكوكي
        if (!current?.isActive) throw new Error("الحساب موقوف أو محذوف — أُنهيت الجلسة");
        token.role = current.role;
        token.name = current.fullName;
        token.checkedAt = now;
      }
      return token;
    },
    async session({ session, token }) {
      session.user.id = token.id;
      session.user.role = token.role;
      session.user.name = token.name;
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
