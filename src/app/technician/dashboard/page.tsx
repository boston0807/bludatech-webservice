// src/app/technician/dashboard/page.tsx
import Link from "next/link";
import { Briefcase, ClipboardCheck, Package } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function TechnicianDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">ยินดีต้อนรับ ช่าง / หัวหน้าช่าง</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/technician/jobs">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Briefcase className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">ใบงานที่รับผิดชอบ</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>ดูรายการงานสำรวจ ติดตั้ง และซ่อมบำรุง</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/technician/workplans">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <ClipboardCheck className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">แผนงาน</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>จัดทำและติดตามแผนการปฏิบัติงาน</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/technician/materials">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Package className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">ตรวจสต็อกอุปกรณ์</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>ตรวจสอบยอดอะไหล่และวัสดุ</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
