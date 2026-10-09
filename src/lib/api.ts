import { NextResponse } from "next/server";
import { Prisma, type Role } from "@prisma/client";
import { ZodError, type ZodType } from "zod";
import { getSessionUser } from "@/lib/auth/session";
import { prisma } from "@/lib/prisma";

export class ApiError extends Error {
  constructor(public status: number, message: string, public details?: unknown) {
    super(message);
  }
}

export type SessionUser = NonNullable<Awaited<ReturnType<typeof getSessionUser>>>;

export async function requireRole(...roles: Role[]): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) throw new ApiError(401, "يجب تسجيل الدخول");
  if (roles.length && !roles.includes(user.role) && user.role !== "ADMIN") {
    throw new ApiError(403, "ليست لديك صلاحية لتنفيذ هذا الإجراء");
  }
  return user;
}

export async function parseBody<T>(req: Request, schema: ZodType<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "صيغة الطلب غير صحيحة");
  }
  return schema.parse(json);
}

/** غلاف موحد لمعالجة الأخطاء في مسارات الـ API */
export function handler<C = unknown>(fn: (req: Request, ctx: C) => Promise<Response>) {
  return async (req: Request, ctx: C) => {
    try {
      return await fn(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return NextResponse.json({ error: e.message, details: e.details }, { status: e.status });
      if (e instanceof ZodError) {
        return NextResponse.json(
          { error: "بيانات غير صالحة", details: e.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
          { status: 422 }
        );
      }
      if (e instanceof Error && e.name === "StorageNotConfiguredError") return NextResponse.json({ error: e.message }, { status: 503 });
      // تعارض تزامن (مثل تحضيرين في اللحظة نفسها): القيد الفريد يمنع التكرار — نعيده نزاعاً واضحاً لا خطأ خادم
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
        return NextResponse.json({ error: "العملية مكرّرة أو نُفّذت مسبقاً" }, { status: 409 });
      }
      // قيمة فارغة لحقل مطلوب في قاعدة البيانات: خطأ إدخال (422) لا خطأ خادم
      if (e instanceof Prisma.PrismaClientValidationError || (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2011")) {
        console.warn("[422] Prisma validation:", e.message.split("\n").slice(-2).join(" "));
        return NextResponse.json({ error: "لا يمكن ترك حقل مطلوب فارغاً" }, { status: 422 });
      }
      console.error(e);
      return NextResponse.json({ error: "خطأ غير متوقع في الخادم" }, { status: 500 });
    }
  };
}

export function clientIp(req: Request): string | null {
  return req.headers.get("x-forwarded-for")?.split(",")[0].trim() ?? req.headers.get("x-real-ip");
}

export async function audit(actorId: string | null, action: string, entity: string, entityId?: string, meta?: object, ip?: string | null) {
  await prisma.auditLog.create({ data: { actorId, action, entity, entityId, meta: meta as object | undefined, ipAddress: ip ?? undefined } });
}
