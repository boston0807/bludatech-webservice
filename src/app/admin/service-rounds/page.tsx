// src/app/admin/service-rounds/page.tsx — สัญญาบำรุงรักษาและรอบบำรุงประจำเดือน (BP ข้อ 19)
import { ServiceRoundsPanel } from "@/components/dashboard/widgets";
import { SERVICE_AUTO_CREATE_DAYS, SERVICE_REMINDER_DAYS } from "@/lib/service-history";

export default function AdminServiceRoundsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">รอบบำรุงรักษาประจำเดือน</h1>
        <p className="text-muted-foreground">
          ระบบสร้างใบงานรอบบำรุงให้อัตโนมัติทุกวัน 07:00 น. เมื่อเหลือไม่เกิน {SERVICE_AUTO_CREATE_DAYS} วันก่อนถึงกำหนด
          และแจ้งเตือนธุรการ ช่าง และลูกค้า — กดสร้างเองได้ล่วงหน้าไม่เกิน {SERVICE_REMINDER_DAYS} วัน
        </p>
      </div>
      <ServiceRoundsPanel showAll />
    </div>
  );
}
