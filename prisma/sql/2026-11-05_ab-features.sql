-- เพิ่มฟีเจอร์ A/B (มอบหมายช่าง, safety checklist, ใบแจ้งหนี้ร่าง, รอบบำรุง ฯลฯ)
-- เป็นการเพิ่มเท่านั้น ไม่ลบข้อมูลเดิม — ใช้ `npx prisma db push` ได้เลย หรือรันไฟล์นี้ใน Supabase SQL Editor แทนก็ได้ (เลือกอย่างใดอย่างหนึ่ง)

-- CreateEnum
CREATE TYPE "SurveyMethod" AS ENUM ('ONSITE', 'REMOTE');

-- AlterEnum
ALTER TYPE "WorkPlanStatus" ADD VALUE 'REJECTED';

-- AlterEnum
ALTER TYPE "ReceiptStatus" ADD VALUE 'DRAFT';

-- DropForeignKey
ALTER TABLE "receipts" DROP CONSTRAINT "receipts_employee_id_fkey";

-- AlterTable
ALTER TABLE "customers" ADD COLUMN     "reject_note" TEXT;

-- AlterTable
ALTER TABLE "jobs" ADD COLUMN     "parent_job_id" TEXT,
ADD COLUMN     "rework_note" TEXT;

-- AlterTable
ALTER TABLE "job_services" ADD COLUMN     "next_service_date" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "surveys" ADD COLUMN     "method" "SurveyMethod" NOT NULL DEFAULT 'ONSITE';

-- AlterTable
ALTER TABLE "work_plans" ADD COLUMN     "reject_note" TEXT;

-- AlterTable
ALTER TABLE "receipts" ALTER COLUMN "employee_id" DROP NOT NULL;

-- CreateTable
CREATE TABLE "work_plan_technicians" (
    "plan_id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,

    CONSTRAINT "work_plan_technicians_pkey" PRIMARY KEY ("plan_id","employee_id")
);

-- CreateTable
CREATE TABLE "safety_checks" (
    "check_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "technician_id" TEXT NOT NULL,
    "passed" BOOLEAN NOT NULL,
    "items" JSONB NOT NULL,
    "note" TEXT,
    "checked_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "safety_checks_pkey" PRIMARY KEY ("check_id")
);

-- AddForeignKey
ALTER TABLE "jobs" ADD CONSTRAINT "jobs_parent_job_id_fkey" FOREIGN KEY ("parent_job_id") REFERENCES "jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_plan_technicians" ADD CONSTRAINT "work_plan_technicians_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "work_plans"("plan_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "work_plan_technicians" ADD CONSTRAINT "work_plan_technicians_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "receipts" ADD CONSTRAINT "receipts_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_checks" ADD CONSTRAINT "safety_checks_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("job_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "safety_checks" ADD CONSTRAINT "safety_checks_technician_id_fkey" FOREIGN KEY ("technician_id") REFERENCES "employees"("employee_id") ON DELETE RESTRICT ON UPDATE CASCADE;

