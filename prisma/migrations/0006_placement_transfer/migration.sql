-- إضافة حالة «منقول» إلى الإسناد
ALTER TYPE "PlacementStatus" ADD VALUE IF NOT EXISTS 'TRANSFERRED';

-- استبدال قيد «إسناد واحد لكل طالب في الفصل» بفهرس جزئي يستثني المؤرشف
-- (حتى يُسمح بإسناد جديد عند النقل مع بقاء الإسناد القديم مؤرشفاً)
-- قائمة موجبة بالحالات الفعّالة فقط (لا تُسمّي القيمة الجديدة، فيُطبَّق الفهرس ضمن المعاملة نفسها)
DROP INDEX IF EXISTS "Placement_studentId_termId_key";
CREATE UNIQUE INDEX "Placement_student_term_active_key"
  ON "Placement"("studentId", "termId")
  WHERE "status" IN ('DRAFT', 'ASSIGNED', 'ACTIVE', 'COMPLETED', 'SUSPENDED');

-- سجل نقل الطالب بين مقرّي تدريب
CREATE TABLE "PlacementTransfer" (
    "id" TEXT NOT NULL,
    "studentId" TEXT NOT NULL,
    "fromPlacementId" TEXT NOT NULL,
    "toPlacementId" TEXT NOT NULL,
    "fromOrganizationId" TEXT NOT NULL,
    "toOrganizationId" TEXT NOT NULL,
    "fromFieldSupervisorId" TEXT,
    "toFieldSupervisorId" TEXT,
    "reason" TEXT NOT NULL,
    "carryOverHours" BOOLEAN NOT NULL,
    "carriedMinutes" INTEGER NOT NULL DEFAULT 0,
    "effectiveDate" DATE NOT NULL,
    "transferredById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PlacementTransfer_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "PlacementTransfer_fromPlacementId_key" ON "PlacementTransfer"("fromPlacementId");
CREATE UNIQUE INDEX "PlacementTransfer_toPlacementId_key" ON "PlacementTransfer"("toPlacementId");
CREATE INDEX "PlacementTransfer_studentId_idx" ON "PlacementTransfer"("studentId");
CREATE INDEX "PlacementTransfer_createdAt_idx" ON "PlacementTransfer"("createdAt");

ALTER TABLE "PlacementTransfer" ADD CONSTRAINT "PlacementTransfer_studentId_fkey" FOREIGN KEY ("studentId") REFERENCES "StudentProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlacementTransfer" ADD CONSTRAINT "PlacementTransfer_fromPlacementId_fkey" FOREIGN KEY ("fromPlacementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlacementTransfer" ADD CONSTRAINT "PlacementTransfer_toPlacementId_fkey" FOREIGN KEY ("toPlacementId") REFERENCES "Placement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "PlacementTransfer" ADD CONSTRAINT "PlacementTransfer_transferredById_fkey" FOREIGN KEY ("transferredById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
