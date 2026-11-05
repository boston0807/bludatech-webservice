// src/app/admin/service-rounds/page.tsx — สัญญาบำรุงรักษาและรอบบำรุงประจำเดือน (BP ข้อ 19)
import { ServiceRoundsPanel } from "@/components/dashboard/widgets";

export default function AdminServiceRoundsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">รอบบำรุงรักษาประจำเดือน</h1>
        <p className="text-muted-foreground">
          ติดตามสัญญาบำรุงรักษาของลูกค้า และสร้างใบงานรอบบำรุงเมื่อใกล้ถึงกำหนด ระบบจะส่งอีเมลแจ้งลูกค้าให้อัตโนมัติ
        </p>
      </div>
      <ServiceRoundsPanel showAll />
    </div>
  );
}
