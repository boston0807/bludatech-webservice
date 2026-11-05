-- ไฟล์แนบ (สลิป / รูปถ่ายหน้างาน) และการแจ้งเตือนในระบบ
-- เป็นการเพิ่มเท่านั้น ไม่ลบข้อมูลเดิม — ใช้ `npx prisma db push` ได้เลย หรือรันไฟล์นี้ใน Supabase SQL Editor แทนก็ได้
-- ส่วน "Storage bucket" ด้านล่างต้องรันใน Supabase SQL Editor เสมอ (db push ไม่ได้สร้างให้)

-- CreateEnum
CREATE TYPE "AttachmentCategory" AS ENUM ('PAYMENT_SLIP', 'SURVEY', 'SAFETY_CHECK', 'WORK_BEFORE', 'WORK_AFTER');

-- CreateTable
CREATE TABLE "attachments" (
    "attachment_id" TEXT NOT NULL,
    "job_id" TEXT NOT NULL,
    "category" "AttachmentCategory" NOT NULL,
    "storage_path" TEXT NOT NULL,
    "file_name" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "caption" TEXT,
    "uploaded_by_employee_id" TEXT,
    "uploaded_by_customer_id" TEXT,
    "survey_id" TEXT,
    "safety_check_id" TEXT,
    "payment_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "attachments_pkey" PRIMARY KEY ("attachment_id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "notification_id" TEXT NOT NULL,
    "employee_id" TEXT,
    "customer_id" TEXT,
    "type" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT,
    "link" TEXT,
    "read_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("notification_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "attachments_storage_path_key" ON "attachments"("storage_path");

-- CreateIndex
CREATE INDEX "attachments_job_id_category_idx" ON "attachments"("job_id", "category");

-- CreateIndex
CREATE INDEX "notifications_employee_id_created_at_idx" ON "notifications"("employee_id", "created_at");

-- CreateIndex
CREATE INDEX "notifications_customer_id_created_at_idx" ON "notifications"("customer_id", "created_at");

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("job_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_employee_id_fkey" FOREIGN KEY ("uploaded_by_employee_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_uploaded_by_customer_id_fkey" FOREIGN KEY ("uploaded_by_customer_id") REFERENCES "customers"("customer_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_survey_id_fkey" FOREIGN KEY ("survey_id") REFERENCES "surveys"("survey_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_safety_check_id_fkey" FOREIGN KEY ("safety_check_id") REFERENCES "safety_checks"("check_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "attachments" ADD CONSTRAINT "attachments_payment_id_fkey" FOREIGN KEY ("payment_id") REFERENCES "payments"("payment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_customer_id_fkey" FOREIGN KEY ("customer_id") REFERENCES "customers"("customer_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Storage bucket ─────────────────────────────────────────
-- bucket ส่วนตัว (public = false): ไฟล์เปิดได้ผ่าน signed URL ที่ server ออกให้หลังตรวจสิทธิ์เท่านั้น
-- จำกัดขนาด 10 MB และชนิดไฟล์ที่รับ (server ตรวจซ้ำอีกชั้น)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('job-files', 'job-files', false, 10485760, ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;
