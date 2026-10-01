// src/app/technician/materials/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Material = {
  id: string;
  materialName: string;
  stockQuantity: number;
  unit?: string;
  price: number;
};

export default function TechnicianMaterialsPage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/materials")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMaterials(d.data);
        else setError(d.message ?? "โหลดข้อมูลสต็อกไม่สำเร็จ");
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ตรวจสอบสต็อกอุปกรณ์และอะไหล่</h1>
        <p className="text-muted-foreground">ตรวจสอบยอดคงเหลือวัสดุอุปกรณ์สำหรับงานติดตั้งและซ่อมบำรุงลิฟต์</p>
      </div>

      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {error && (
        <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
          {error}
        </div>
      )}

      {!loading && !error && materials.length === 0 && (
        <Card>
          <CardContent className="py-20 text-center text-muted-foreground">
            ไม่มีรายการวัสดุในระบบ
          </CardContent>
        </Card>
      )}

      {!loading && !error && materials.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((mat) => {
            const isLowStock = mat.stockQuantity <= 5;
            return (
              <Card key={mat.id} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-full p-2">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{mat.materialName}</CardTitle>
                  </div>
                  <Badge variant={isLowStock ? "warning" : "success"}>
                    {isLowStock ? (
                      <span className="flex items-center gap-1">
                        <AlertTriangle className="h-3 w-3" /> ใกล้หมด
                      </span>
                    ) : (
                      <span className="flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" /> พร้อมใช้
                      </span>
                    )}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">จำนวนคงเหลือ:</span>
                    <span className={`font-bold ${isLowStock ? "text-amber-600" : "text-foreground"}`}>
                      {mat.stockQuantity} {mat.unit ?? "ชิ้น"}
                    </span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ราคาต่อหน่วย:</span>
                    <span>{mat.price.toLocaleString()} บาท</span>
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
