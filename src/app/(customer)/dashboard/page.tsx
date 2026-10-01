// src/app/(customer)/dashboard/page.tsx
import Link from "next/link";
import { FilePlus, FileText, CreditCard } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function CustomerDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">ยินดีต้อนรับ สู่ระบบบริการลิฟต์</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/jobs/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <FilePlus className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">ยื่นคำขอบริการ</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>ยื่นคำขอติดตั้ง ซ่อม หรือบำรุงรักษาลิฟต์</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/jobs">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <FileText className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">ใบงานของฉัน</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>ติดตามสถานะงานและอนุมัติใบเสนอราคา</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/invoices">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <CreditCard className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">ใบแจ้งหนี้</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>ดูและชำระเงินค่าบริการ</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
