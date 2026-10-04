-- رسالة نصية اختيارية للمشرف المؤسسي عند وصول المتدرب (أول تحضير ناجح في اليوم)
ALTER TABLE "FieldSupervisorProfile" ADD COLUMN "smsOnArrival" BOOLEAN NOT NULL DEFAULT false;
