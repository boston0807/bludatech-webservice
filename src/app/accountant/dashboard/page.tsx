// src/app/accountant/dashboard/page.tsx
import Link from "next/link";
import { FileText, ShoppingCart, Receipt } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function AccountantDashboard() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">ยินดีต้อนรับ พนักงานบัญชี</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Link href="/accountant/quotations">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <FileText className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">ใบเสนอราคา</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>จัดทำและส่งใบเสนอราคาให้ลูกค้า</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/accountant/purchase">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <ShoppingCart className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">สั่งซื้ออุปกรณ์</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>จัดซื้ออะไหล่และอุปกรณ์เพิ่มเติม</CardDescription>
            </CardContent>
          </Card>
        </Link>

        <Link href="/accountant/invoices">
          <Card className="hover:shadow-md transition-shadow cursor-pointer">
            <CardHeader className="flex flex-row items-center gap-3 pb-2">
              <Receipt className="h-6 w-6 text-primary" />
              <CardTitle className="text-base">ใบแจ้งหนี้</CardTitle>
            </CardHeader>
            <CardContent>
              <CardDescription>ออกใบแจ้งหนี้และติดตามการชำระเงิน</CardDescription>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  );
}
