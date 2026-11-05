-- ประวัติการเคลื่อนไหวของสต็อก (stock_movements)
-- เป็นการเพิ่มเท่านั้น ไม่ลบข้อมูลเดิม — ใช้ `npx prisma db push` ได้เลย หรือรันไฟล์นี้ใน Supabase SQL Editor แทนก็ได้ (เลือกอย่างใดอย่างหนึ่ง)
-- ถ้าใช้ db push ให้รันเฉพาะส่วน "ยอดตั้งต้น" ด้านล่างเพิ่มเองหลัง push

-- CreateEnum
CREATE TYPE "StockMovementReason" AS ENUM ('INITIAL', 'RESTOCK', 'JOB_USAGE', 'ADJUSTMENT');

-- CreateTable
CREATE TABLE "stock_movements" (
    "movement_id" TEXT NOT NULL,
    "material_id" TEXT NOT NULL,
    "change" INTEGER NOT NULL,
    "balance_after" INTEGER NOT NULL,
    "reason" "StockMovementReason" NOT NULL,
    "job_id" TEXT,
    "employee_id" TEXT,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("movement_id")
);

-- CreateIndex
CREATE INDEX "stock_movements_material_id_created_at_idx" ON "stock_movements"("material_id", "created_at");

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("material_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_job_id_fkey" FOREIGN KEY ("job_id") REFERENCES "jobs"("job_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("employee_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- ยอดตั้งต้น: บันทึกยอดคงเหลือปัจจุบันของวัสดุทุกตัวเป็น 1 แถว เพื่อให้ผลรวมของ change ตรงกับ stock_quantity
-- (ไม่รวมแถวข้อมูลลิฟต์ที่ขึ้นต้นด้วย @elevator-)
INSERT INTO "stock_movements" ("movement_id", "material_id", "change", "balance_after", "reason", "note")
SELECT 'init_' || "material_id", "material_id", "stock_quantity", "stock_quantity", 'INITIAL', 'ยอดยกมาก่อนเริ่มบันทึกประวัติสต็อก'
FROM "materials"
WHERE "material_name" NOT LIKE '@elevator-%'
ON CONFLICT ("movement_id") DO NOTHING;
