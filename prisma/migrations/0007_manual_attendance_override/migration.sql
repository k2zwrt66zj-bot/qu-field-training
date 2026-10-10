-- تحضير يدوي استثنائي من المشرف المؤسسي (تعذّر جوال/إنترنت الطالب)
ALTER TABLE "AttendanceRecord"
  ADD COLUMN "isManualOverride" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "overrideReason" TEXT,
  ADD COLUMN "overriddenById" TEXT;

ALTER TABLE "AttendanceRecord"
  ADD CONSTRAINT "AttendanceRecord_overriddenById_fkey"
  FOREIGN KEY ("overriddenById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
