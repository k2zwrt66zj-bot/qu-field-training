-- CreateEnum
CREATE TYPE "FormKind" AS ENUM ('COMMENCEMENT', 'ORGANIZATION_PROFILE', 'TRAINING_PLAN', 'SKILLS_LOG', 'GROUP_PROGRAM', 'COMMUNITY_PROGRAM', 'QUICK_SITUATION', 'CASE_STUDY', 'INTERVIEW', 'READING', 'CUSTOM');

-- CreateEnum
CREATE TYPE "TrainingMode" AS ENUM ('FIELD', 'SIMULATION');

-- CreateEnum
CREATE TYPE "TrainingShift" AS ENUM ('MORNING', 'EVENING');

-- CreateEnum
CREATE TYPE "SituationDomain" AS ENUM ('SCHOOL', 'MEDICAL');

-- CreateEnum
CREATE TYPE "MedicalVisitType" AS ENUM ('FIRST_VISIT', 'INPATIENT', 'SURGERY', 'FOLLOW_UP', 'FAMILY_MEMBER');

-- CreateEnum
CREATE TYPE "CaseFinalOutcome" AS ENUM ('POSITIVE_CHANGE', 'NO_CHANGE', 'DETERIORATED');

-- CreateEnum
CREATE TYPE "TerminationType" AS ENUM ('PLANNED', 'UNPLANNED');

-- CreateEnum
CREATE TYPE "FollowUpInterval" AS ENUM ('CLOSE', 'SPACED');

-- CreateEnum
CREATE TYPE "FollowUpPurpose" AS ENUM ('SERVICE_EVALUATION', 'COMMUNITY_ACCOUNTABILITY', 'CLIENT_ATTACHMENT');

-- CreateEnum
CREATE TYPE "FollowUpMethod" AS ENUM ('PHONE_CALLS', 'HOME_VISITS', 'MAILED_SURVEYS');

-- CreateEnum
CREATE TYPE "ReadingSourceType" AS ENUM ('BOOK_CHAPTER', 'JOURNAL_ARTICLE', 'CONFERENCE_PAPER');

-- CreateEnum
CREATE TYPE "MeetingAttendanceStatus" AS ENUM ('PRESENT', 'ABSENT_EXCUSED', 'ABSENT_UNEXCUSED');

-- CreateEnum
CREATE TYPE "SignatureSlot" AS ENUM ('STUDENT', 'FIELD_SUPERVISOR', 'ORG_DIRECTOR', 'ACADEMIC_SUPERVISOR', 'TRAINING_HEAD', 'MEETING_CHAIR', 'MEETING_SECRETARY', 'MEETING_MEMBER');

-- CreateEnum
CREATE TYPE "AttachmentKind" AS ENUM ('EVIDENCE', 'DOCUMENT', 'STAMP');

-- AlterTable
ALTER TABLE "Organization" ADD COLUMN     "beneficiariesCount" INTEGER,
ADD COLUMN     "directorName" TEXT,
ADD COLUMN     "phone" TEXT,
ADD COLUMN     "socialWorkersCount" INTEGER;

-- AlterTable
ALTER TABLE "Placement" ADD COLUMN     "commencedAt" DATE,
ADD COLUMN     "sectionId" TEXT,
ADD COLUMN     "shift" "TrainingShift";

-- AlterTable
ALTER TABLE "AttendanceRecord" ADD COLUMN     "sheetId" TEXT;

-- CreateTable
CREATE TABLE "CourseSection" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "courseCode" TEXT,
    "courseName" TEXT NOT NULL,
    "sectionNumber" TEXT NOT NULL,
    "trainingNumber" INTEGER NOT NULL,
    "track" TEXT,
    "mode" "TrainingMode" NOT NULL DEFAULT 'FIELD',
    "major" "Major",
    "academicSupervisorId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CourseSection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FieldForm" (
    "id" TEXT NOT NULL,
    "kind" "FormKind" NOT NULL,
    "placementId" TEXT NOT NULL,
    "sequence" INTEGER NOT NULL DEFAULT 1,
    "title" TEXT,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "fieldApprovedAt" TIMESTAMP(3),
    "fieldApprovedById" TEXT,
    "academicApprovedAt" TIMESTAMP(3),
    "academicApprovedById" TEXT,
    "academicScore" DECIMAL(5,2),
    "lockedAt" TIMESTAMP(3),
    "templateKey" TEXT,
    "data" JSONB,
    "createdById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FieldForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormSignature" (
    "id" TEXT NOT NULL,
    "slot" "SignatureSlot" NOT NULL,
    "signatureId" TEXT NOT NULL,
    "signerUserId" TEXT,
    "signerName" TEXT NOT NULL,
    "signerTitle" TEXT,
    "withStamp" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "formId" TEXT,
    "meetingId" TEXT,
    "sheetId" TEXT,

    CONSTRAINT "FormSignature_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Attachment" (
    "id" TEXT NOT NULL,
    "kind" "AttachmentKind" NOT NULL,
    "formId" TEXT,
    "organizationId" TEXT,
    "uploadedById" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "caption" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Attachment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FormComment" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "resolved" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "FormComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CommencementForm" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "commencementDate" DATE NOT NULL,
    "fixedTrainingDay" INTEGER NOT NULL,
    "shift" "TrainingShift" NOT NULL,
    "supervisorMobile" TEXT,
    "organizationEmail" TEXT,
    "directorName" TEXT,
    "declarationAccepted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "CommencementForm_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrganizationProfileReport" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "organizationName" TEXT NOT NULL,
    "location" TEXT,
    "contactNumbers" TEXT,
    "workField" TEXT,
    "officialHours" TEXT,
    "trainingDays" TEXT,
    "directorName" TEXT,
    "supervisorName" TEXT,
    "supervisorMobile" TEXT,
    "goals" TEXT,
    "socialWorkersCount" INTEGER,
    "beneficiariesCount" INTEGER,
    "policies" TEXT,
    "servicesOffered" TEXT,
    "eligibilityConditions" TEXT,
    "accessProcedures" TEXT,
    "beneficiaryGroups" TEXT,
    "relatedOrganizations" TEXT,
    "communityPrograms" TEXT,
    "socialWorkerRoles" TEXT[],
    "studentNotes" TEXT,

    CONSTRAINT "OrganizationProfileReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "OrgProfessionalGroup" (
    "id" TEXT NOT NULL,
    "profileId" TEXT NOT NULL,
    "specialty" TEXT NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "OrgProfessionalGroup_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlan" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "generalGoal" TEXT,

    CONSTRAINT "TrainingPlan_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TrainingPlanWeek" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "tasks" TEXT NOT NULL,
    "responsible" TEXT NOT NULL,

    CONSTRAINT "TrainingPlanWeek_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SkillsLog" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "weekNumber" INTEGER NOT NULL,
    "logDate" DATE NOT NULL,
    "planWeekId" TEXT,
    "topics" TEXT[],
    "skillsNarrative" TEXT NOT NULL,
    "knowledgeNarrative" TEXT NOT NULL,
    "difficulties" TEXT,

    CONSTRAINT "SkillsLog_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProgramReport" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "programDate" DATE NOT NULL,
    "startTime" TEXT,
    "durationMinutes" INTEGER,
    "membersCount" INTEGER,
    "supervisorsCount" INTEGER,
    "advisorName" TEXT,
    "leaderName" TEXT,
    "programType" TEXT,
    "programTitle" TEXT NOT NULL,
    "goals" TEXT,
    "preparationPart" TEXT,
    "narrativePart" TEXT,
    "analyticalPart" TEXT,
    "planningPart" TEXT,
    "executionPart" TEXT,
    "positives" TEXT[],
    "negatives" TEXT[],

    CONSTRAINT "ProgramReport_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "QuickSituation" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "domain" "SituationDomain" NOT NULL,
    "situationDate" DATE NOT NULL,
    "subjectName" TEXT,
    "schoolGrade" TEXT,
    "medicalFileNumber" TEXT,
    "medicalVisitType" "MedicalVisitType",
    "hospitalDepartment" TEXT,
    "referralSource" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "actionsTaken" TEXT NOT NULL,

    CONSTRAINT "QuickSituation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseStudy" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "caseAlias" TEXT NOT NULL,
    "consentConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "physicalAspect" TEXT,
    "psychologicalAspect" TEXT,
    "mentalAspect" TEXT,
    "behavioralAspect" TEXT,
    "familyDynamics" TEXT,
    "otherSystemsRelations" TEXT,
    "mainProblem" TEXT,
    "subProblems" TEXT[],
    "strengths" TEXT,
    "participatingSystems" TEXT,
    "mainGoal" TEXT,
    "subGoals" TEXT[],
    "professionalContract" TEXT,
    "therapeuticModels" TEXT[],
    "techniques" TEXT[],
    "initProblemsWellFormulated" BOOLEAN,
    "initGoalsMeasurable" BOOLEAN,
    "initGoalsAchievable" BOOLEAN,
    "initTechniquesAppropriate" BOOLEAN,
    "initResponsibilitiesClear" BOOLEAN,
    "assessmentPositives" TEXT,
    "assessmentNegatives" TEXT,
    "planningPositives" TEXT,
    "planningNegatives" TEXT,
    "interventionPositives" TEXT,
    "interventionNegatives" TEXT,
    "finalOutcome" "CaseFinalOutcome",
    "terminationType" "TerminationType",
    "plannedGoalsAchieved" BOOLEAN,
    "plannedTimeAppropriate" BOOLEAN,
    "plannedProblemHandled" BOOLEAN,
    "plannedResourcesUsed" BOOLEAN,
    "plannedNeedsReferral" BOOLEAN,
    "unplannedWorkerFactors" TEXT,
    "unplannedClientFactors" TEXT,
    "unplannedSharedFactors" TEXT,
    "followUpInterval" "FollowUpInterval",
    "followUpPurposes" "FollowUpPurpose"[],
    "followUpMethods" "FollowUpMethod"[],
    "resultPerformsSocialRole" BOOLEAN,
    "resultUsesLearnedSkills" BOOLEAN,
    "resultNeedsOtherServices" BOOLEAN,

    CONSTRAINT "CaseStudy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CaseFamilyMember" (
    "id" TEXT NOT NULL,
    "caseStudyId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "age" INTEGER,
    "relation" TEXT NOT NULL,
    "education" TEXT,
    "occupation" TEXT,
    "healthStatus" TEXT,
    "maritalStatus" TEXT,
    "notes" TEXT,

    CONSTRAINT "CaseFamilyMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewRecord" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "caseStudyId" TEXT,
    "interviewDate" DATE NOT NULL,
    "durationMinutes" INTEGER,
    "location" TEXT,
    "parties" TEXT NOT NULL,
    "goals" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "skillsUsed" TEXT,
    "nextPlan" TEXT,
    "positives" TEXT,

    CONSTRAINT "InterviewRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "InterviewDifficulty" (
    "id" TEXT NOT NULL,
    "interviewId" TEXT NOT NULL,
    "order" INTEGER NOT NULL,
    "difficulty" TEXT NOT NULL,
    "coping" TEXT NOT NULL,

    CONSTRAINT "InterviewDifficulty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ReadingRecord" (
    "id" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "sourceType" "ReadingSourceType" NOT NULL,
    "readingDate" DATE NOT NULL,
    "authors" TEXT[],
    "publicationYear" INTEGER,
    "title" TEXT NOT NULL,
    "containerTitle" TEXT,
    "editors" TEXT,
    "volume" TEXT,
    "issue" TEXT,
    "pages" TEXT,
    "publisher" TEXT,
    "doi" TEXT,
    "url" TEXT,
    "apaCitation" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "professionalBenefit" TEXT NOT NULL,

    CONSTRAINT "ReadingRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SupervisionMeeting" (
    "id" TEXT NOT NULL,
    "termId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "academicSupervisorId" TEXT NOT NULL,
    "sectionId" TEXT,
    "number" INTEGER NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "meetingDate" DATE NOT NULL,
    "startTime" TEXT,
    "durationMinutes" INTEGER,
    "location" TEXT,
    "approvePreviousMinutes" BOOLEAN NOT NULL DEFAULT true,
    "agendaItems" TEXT[],
    "minutes" TEXT,
    "decisions" TEXT[],
    "secretaryPlacementId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SupervisionMeeting_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MeetingAttendance" (
    "id" TEXT NOT NULL,
    "meetingId" TEXT NOT NULL,
    "placementId" TEXT NOT NULL,
    "status" "MeetingAttendanceStatus" NOT NULL DEFAULT 'PRESENT',
    "excuse" TEXT,

    CONSTRAINT "MeetingAttendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AttendanceSheet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sheetDate" DATE NOT NULL,
    "weekNumber" INTEGER,
    "fieldSupervisorId" TEXT,
    "recordsHash" TEXT,
    "signedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AttendanceSheet_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "CourseSection_termId_sectionNumber_key" ON "CourseSection"("termId", "sectionNumber");

-- CreateIndex
CREATE INDEX "FieldForm_placementId_kind_idx" ON "FieldForm"("placementId", "kind");

-- CreateIndex
CREATE INDEX "FieldForm_status_idx" ON "FieldForm"("status");

-- CreateIndex
CREATE UNIQUE INDEX "FieldForm_placementId_kind_sequence_key" ON "FieldForm"("placementId", "kind", "sequence");

-- CreateIndex
CREATE UNIQUE INDEX "FormSignature_signatureId_key" ON "FormSignature"("signatureId");

-- CreateIndex
CREATE UNIQUE INDEX "FormSignature_formId_slot_key" ON "FormSignature"("formId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "FormSignature_meetingId_slot_signerUserId_key" ON "FormSignature"("meetingId", "slot", "signerUserId");

-- CreateIndex
CREATE UNIQUE INDEX "FormSignature_sheetId_slot_key" ON "FormSignature"("sheetId", "slot");

-- CreateIndex
CREATE UNIQUE INDEX "Attachment_storageKey_key" ON "Attachment"("storageKey");

-- CreateIndex
CREATE INDEX "Attachment_formId_idx" ON "Attachment"("formId");

-- CreateIndex
CREATE INDEX "Attachment_organizationId_kind_idx" ON "Attachment"("organizationId", "kind");

-- CreateIndex
CREATE INDEX "FormComment_formId_idx" ON "FormComment"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "CommencementForm_formId_key" ON "CommencementForm"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "OrganizationProfileReport_formId_key" ON "OrganizationProfileReport"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlan_formId_key" ON "TrainingPlan"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "TrainingPlanWeek_planId_weekNumber_key" ON "TrainingPlanWeek"("planId", "weekNumber");

-- CreateIndex
CREATE UNIQUE INDEX "SkillsLog_formId_key" ON "SkillsLog"("formId");

-- CreateIndex
CREATE INDEX "SkillsLog_logDate_idx" ON "SkillsLog"("logDate");

-- CreateIndex
CREATE UNIQUE INDEX "ProgramReport_formId_key" ON "ProgramReport"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "QuickSituation_formId_key" ON "QuickSituation"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseStudy_formId_key" ON "CaseStudy"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "CaseFamilyMember_caseStudyId_order_key" ON "CaseFamilyMember"("caseStudyId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewRecord_formId_key" ON "InterviewRecord"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "InterviewDifficulty_interviewId_order_key" ON "InterviewDifficulty"("interviewId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "ReadingRecord_formId_key" ON "ReadingRecord"("formId");

-- CreateIndex
CREATE UNIQUE INDEX "SupervisionMeeting_termId_organizationId_academicSupervisor_key" ON "SupervisionMeeting"("termId", "organizationId", "academicSupervisorId", "number");

-- CreateIndex
CREATE UNIQUE INDEX "MeetingAttendance_meetingId_placementId_key" ON "MeetingAttendance"("meetingId", "placementId");

-- CreateIndex
CREATE UNIQUE INDEX "AttendanceSheet_organizationId_sheetDate_key" ON "AttendanceSheet"("organizationId", "sheetDate");

-- CreateIndex
CREATE INDEX "Placement_sectionId_idx" ON "Placement"("sectionId");

-- AddForeignKey
ALTER TABLE "Placement" ADD CONSTRAINT "Placement_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceRecord" ADD CONSTRAINT "AttendanceRecord_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "AttendanceSheet"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CourseSection" ADD CONSTRAINT "CourseSection_academicSupervisorId_fkey" FOREIGN KEY ("academicSupervisorId") REFERENCES "AcademicSupervisorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldForm" ADD CONSTRAINT "FieldForm_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldForm" ADD CONSTRAINT "FieldForm_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldForm" ADD CONSTRAINT "FieldForm_fieldApprovedById_fkey" FOREIGN KEY ("fieldApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FieldForm" ADD CONSTRAINT "FieldForm_academicApprovedById_fkey" FOREIGN KEY ("academicApprovedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSignature" ADD CONSTRAINT "FormSignature_signatureId_fkey" FOREIGN KEY ("signatureId") REFERENCES "Signature"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSignature" ADD CONSTRAINT "FormSignature_signerUserId_fkey" FOREIGN KEY ("signerUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSignature" ADD CONSTRAINT "FormSignature_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSignature" ADD CONSTRAINT "FormSignature_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "SupervisionMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormSignature" ADD CONSTRAINT "FormSignature_sheetId_fkey" FOREIGN KEY ("sheetId") REFERENCES "AttendanceSheet"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Attachment" ADD CONSTRAINT "Attachment_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormComment" ADD CONSTRAINT "FormComment_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FormComment" ADD CONSTRAINT "FormComment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CommencementForm" ADD CONSTRAINT "CommencementForm_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrganizationProfileReport" ADD CONSTRAINT "OrganizationProfileReport_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "OrgProfessionalGroup" ADD CONSTRAINT "OrgProfessionalGroup_profileId_fkey" FOREIGN KEY ("profileId") REFERENCES "OrganizationProfileReport"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlan" ADD CONSTRAINT "TrainingPlan_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TrainingPlanWeek" ADD CONSTRAINT "TrainingPlanWeek_planId_fkey" FOREIGN KEY ("planId") REFERENCES "TrainingPlan"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillsLog" ADD CONSTRAINT "SkillsLog_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SkillsLog" ADD CONSTRAINT "SkillsLog_planWeekId_fkey" FOREIGN KEY ("planWeekId") REFERENCES "TrainingPlanWeek"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ProgramReport" ADD CONSTRAINT "ProgramReport_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "QuickSituation" ADD CONSTRAINT "QuickSituation_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseStudy" ADD CONSTRAINT "CaseStudy_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CaseFamilyMember" ADD CONSTRAINT "CaseFamilyMember_caseStudyId_fkey" FOREIGN KEY ("caseStudyId") REFERENCES "CaseStudy"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRecord" ADD CONSTRAINT "InterviewRecord_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewRecord" ADD CONSTRAINT "InterviewRecord_caseStudyId_fkey" FOREIGN KEY ("caseStudyId") REFERENCES "CaseStudy"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "InterviewDifficulty" ADD CONSTRAINT "InterviewDifficulty_interviewId_fkey" FOREIGN KEY ("interviewId") REFERENCES "InterviewRecord"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ReadingRecord" ADD CONSTRAINT "ReadingRecord_formId_fkey" FOREIGN KEY ("formId") REFERENCES "FieldForm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionMeeting" ADD CONSTRAINT "SupervisionMeeting_termId_fkey" FOREIGN KEY ("termId") REFERENCES "AcademicTerm"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionMeeting" ADD CONSTRAINT "SupervisionMeeting_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionMeeting" ADD CONSTRAINT "SupervisionMeeting_academicSupervisorId_fkey" FOREIGN KEY ("academicSupervisorId") REFERENCES "AcademicSupervisorProfile"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionMeeting" ADD CONSTRAINT "SupervisionMeeting_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "CourseSection"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SupervisionMeeting" ADD CONSTRAINT "SupervisionMeeting_secretaryPlacementId_fkey" FOREIGN KEY ("secretaryPlacementId") REFERENCES "Placement"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_meetingId_fkey" FOREIGN KEY ("meetingId") REFERENCES "SupervisionMeeting"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MeetingAttendance" ADD CONSTRAINT "MeetingAttendance_placementId_fkey" FOREIGN KEY ("placementId") REFERENCES "Placement"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSheet" ADD CONSTRAINT "AttendanceSheet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AttendanceSheet" ADD CONSTRAINT "AttendanceSheet_fieldSupervisorId_fkey" FOREIGN KEY ("fieldSupervisorId") REFERENCES "FieldSupervisorProfile"("id") ON DELETE SET NULL ON UPDATE CASCADE;

