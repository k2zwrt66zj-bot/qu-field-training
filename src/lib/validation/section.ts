import { z } from "zod";

/** الشعبة: المقرر، رقم الشعبة، «تدريب ميداني رقم ( )»، المسار، ونوع التدريب */
export const sectionSchema = z.object({
  termId: z.string(),
  courseName: z.string().trim().min(3, "اسم المقرر مطلوب").max(120),
  courseCode: z.string().trim().max(20).optional().nullable(),
  sectionNumber: z.string().trim().min(1, "رقم الشعبة مطلوب").max(20),
  trainingNumber: z.number().int().min(1).max(4),
  track: z.string().trim().max(60).optional().nullable(),
  mode: z.enum(["FIELD", "SIMULATION"]),
  major: z.enum(["SOCIOLOGY", "SOCIAL_WORK"]).optional().nullable(),
  academicSupervisorId: z.string().optional().nullable(),
});
