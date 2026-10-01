// src/app/admin/dashboard/page.tsx
import Link from "next/link";
import { Users } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AdminDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">ยินดีต้อนรับ พนักงานธุรการ</p>
      </div>

      <div className="grid grid-cols-1 gap-4">
        <Link href="/admin/customers/pending">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Users className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">อนุมัติลูกค้า</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>ตรวจสอบและอนุมัติการสมัครสมาชิกของลูกค้าใหม่</CardDescription>
            </CardContent>
          </Card>
        </Link>

      </div>
    </div>
  );
}
