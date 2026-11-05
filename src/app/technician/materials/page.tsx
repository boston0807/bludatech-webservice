// src/app/technician/materials/page.tsx
// UC10 ตรวจสอบอะไหล่และอุปกรณ์ — เทียบยอดคงเหลือกับจำนวนที่จองไว้ในแผนงาน
// วัสดุที่ไม่พอระบบแจ้งฝ่ายบัญชีอัตโนมัติ (หน้า "สั่งซื้ออุปกรณ์") ไม่ต้องแจ้งนอกระบบ
"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, AlertTriangle, CheckCircle2, PackageX } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { thDate } from "@/lib/labels";

type Usage = {
  id: string;
  materialName: string;
  price: number;
  stockQuantity: number;
  reservedQty: number;
  availableQty: number;
  shortageQty: number;
};

type Shortage = Usage & {
  reservedBy: { jobId: string; customerName: string; startDate: string; quantity: number }[];
};

export default function TechnicianMaterialsPage() {
  const [usage, setUsage] = useState<Usage[]>([]);
  const [shortages, setShortages] = useState<Shortage[]>([]);
  const [threshold, setThreshold] = useState(5);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/materials/shortages")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setUsage(d.data.usage);
          setShortages(d.data.shortages);
          setThreshold(d.data.threshold);
        } else setError(d.message ?? "โหลดข้อมูลสต็อกไม่สำเร็จ");
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตรวจสอบสต็อกอุปกรณ์และอะไหล่</h1>
        <p className="text-muted-foreground">
          เทียบยอดคงเหลือกับจำนวนที่จองไว้ในแผนงาน — รายการที่ไม่พอ ระบบแจ้งฝ่ายบัญชีให้สั่งซื้อเพิ่มอัตโนมัติ
        </p>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}
      {error && <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{error}</div>}

      {!loading && shortages.length > 0 && (
        <Card className="border-amber-400">
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2 text-amber-800">
              <PackageX className="h-5 w-5" /> อะไหล่ไม่พอสำหรับแผนงานที่จองไว้ ({shortages.length} รายการ)
            </CardTitle>
            <CardDescription>ฝ่ายบัญชีเห็นรายการนี้แล้ว งานเหล่านี้จะเริ่มไม่ได้จนกว่าจะเติมสต็อก</CardDescription>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            {shortages.map((s) => (
              <div key={s.id} className="rounded-md bg-amber-50 px-3 py-2">
                <p className="font-medium">
                  {s.materialName} — ขาด {s.shortageQty} (จอง {s.reservedQty} / คงเหลือ {s.stockQuantity})
                </p>
                <p className="text-xs text-muted-foreground">
                  {s.reservedBy.map((r) => `${r.customerName} ${r.quantity} ชิ้น (เริ่ม ${thDate(r.startDate)})`).join(" · ")}
                </p>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {!loading && !error && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {usage.map((mat) => {
            const isShort = mat.shortageQty > 0;
            const isLow = !isShort && mat.availableQty <= threshold;
            return (
              <Card key={mat.id} className={`shadow-sm ${isShort ? "border-amber-400" : ""}`}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium flex items-center gap-2">
                    <Package className="h-4 w-4 text-primary" />
                    {mat.materialName}
                  </CardTitle>
                  <Badge variant={isShort ? "destructive" : isLow ? "warning" : "success"}>
                    {isShort ? (
                      <span className="flex items-center gap-1"><PackageX className="h-3 w-3" /> ไม่พอ</span>
                    ) : isLow ? (
                      <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> ใกล้หมด</span>
                    ) : (
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> พร้อมใช้</span>
                    )}
                  </Badge>
                </CardHeader>
                <CardContent className="grid grid-cols-3 gap-2 text-center text-xs">
                  <div>
                    <p className="text-muted-foreground">คงเหลือ</p>
                    <p className="text-lg font-bold">{mat.stockQuantity}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">จองในแผน</p>
                    <p className="text-lg font-bold">{mat.reservedQty}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">พร้อมใช้</p>
                    <p className={`text-lg font-bold ${mat.availableQty < 0 ? "text-destructive" : ""}`}>{mat.availableQty}</p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
