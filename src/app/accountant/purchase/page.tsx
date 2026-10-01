// src/app/accountant/purchase/page.tsx
"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, Plus, ShoppingCart, AlertTriangle, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

type Material = {
  id: string;
  materialName: string;
  price: number;
  stockQuantity: number;
};

export default function AccountantPurchasePage() {
  const [materials, setMaterials] = useState<Material[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // New material form
  const [showAddForm, setShowAddForm] = useState(false);
  const [materialName, setMaterialName] = useState("");
  const [price, setPrice] = useState("");
  const [stockQuantity, setStockQuantity] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Restock modal/state
  const [restockMaterial, setRestockMaterial] = useState<Material | null>(null);
  const [addQty, setAddQty] = useState(10);
  const [restocking, setRestocking] = useState(false);

  const fetchMaterials = () => {
    setLoading(true);
    fetch("/api/materials")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setMaterials(d.data);
        else setError(d.message || "ไม่สามารถโหลดข้อมูลวัสดุได้");
      })
      .catch(() => setError("เกิดข้อผิดพลาดในการเชื่อมต่อ"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    fetchMaterials();
  }, []);

  const handleCreateMaterial = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch("/api/materials", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          materialName,
          price: parseFloat(price),
          stockQuantity: parseInt(stockQuantity || "0"),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("เพิ่มวัสดุใหม่สำเร็จ");
        setMaterialName("");
        setPrice("");
        setStockQuantity("");
        setShowAddForm(false);
        fetchMaterials();
      } else {
        setError(data.message || "เพิ่มวัสดุไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการบันทึก");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRestock = async () => {
    if (!restockMaterial) return;
    setRestocking(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const res = await fetch(`/api/materials/${restockMaterial.id}/stock`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ addQuantity: addQty }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg(`เติมสต็อก "${restockMaterial.materialName}" สำเร็จ (+${addQty})`);
        setRestockMaterial(null);
        setAddQty(10);
        fetchMaterials();
      } else {
        setError(data.message || "เติมสต็อกไม่สำเร็จ");
      }
    } catch {
      setError("เกิดข้อผิดพลาดในการเติมสต็อก");
    } finally {
      setRestocking(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">สั่งซื้อและจัดการคลังอุปกรณ์ (UC11)</h1>
          <p className="text-muted-foreground">จัดการรายการอะไหล่ อัปเดตยอดสต็อก และสั่งซื้ออุปกรณ์เข้าคลัง</p>
        </div>
        <Button onClick={() => setShowAddForm(!showAddForm)} className="gap-2">
          <Plus className="h-4 w-4" /> เพิ่มวัสดุใหม่ในระบบ
        </Button>
      </div>

      {error && <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{error}</div>}
      {successMsg && <div className="p-4 bg-green-50 text-green-700 text-sm rounded-md border border-green-200">{successMsg}</div>}

      {/* Add New Material Form */}
      {showAddForm && (
        <Card className="border-primary shadow-md">
          <CardHeader>
            <CardTitle>เพิ่มรายการวัสดุ/อะไหล่ใหม่</CardTitle>
            <CardDescription>กรอกข้อมูลชื่ออุปกรณ์ ราคาต่อหน่วย และจำนวนเริ่มต้นในคลัง</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleCreateMaterial} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="materialName">ชื่ออุปกรณ์/อะไหล่</Label>
                  <Input id="materialName" value={materialName} onChange={(e) => setMaterialName(e.target.value)} placeholder="เช่น สลิงลิฟต์ 10 มม." required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="price">ราคาต่อหน่วย (บาท)</Label>
                  <Input id="price" type="number" step="0.01" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="0.00" required />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="stockQuantity">จำนวนเริ่มต้นในคลัง</Label>
                  <Input id="stockQuantity" type="number" value={stockQuantity} onChange={(e) => setStockQuantity(e.target.value)} placeholder="0" required />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button type="button" variant="outline" onClick={() => setShowAddForm(false)}>ยกเลิก</Button>
                <Button type="submit" disabled={submitting}>
                  {submitting && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />} บันทึกวัสดุ
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Restock Modal / Dialog */}
      {restockMaterial && (
        <Card className="border-amber-500 shadow-lg bg-amber-50/30">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-amber-600" />
              สั่งซื้อ / รับเข้าสต็อก: {restockMaterial.materialName}
            </CardTitle>
            <CardDescription>ยอดคงเหลือปัจจุบัน: {restockMaterial.stockQuantity} ชิ้น | ราคา: {Number(restockMaterial.price).toLocaleString()} บาท</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2 max-w-xs">
              <Label htmlFor="addQty">จำนวนที่ต้องการสั่งซื้อเพิ่มเข้าคลัง</Label>
              <Input id="addQty" type="number" min="1" value={addQty} onChange={(e) => setAddQty(parseInt(e.target.value) || 1)} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setRestockMaterial(null)}>ยกเลิก</Button>
              <Button onClick={handleRestock} disabled={restocking} className="bg-amber-600 hover:bg-amber-700 text-white">
                {restocking && <Loader2 className="h-4 w-4 animate-spin mr-1.5" />}
                ยืนยันรับเข้าสต็อก
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>
      ) : materials.length === 0 ? (
        <Card><CardContent className="py-20 text-center text-muted-foreground">ไม่พบรายการวัสดุในระบบ</CardContent></Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map((mat) => {
            const isLow = mat.stockQuantity <= 5;
            return (
              <Card key={mat.id} className="shadow-sm">
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-full p-2">
                      <Package className="h-5 w-5 text-primary" />
                    </div>
                    <CardTitle className="text-base">{mat.materialName}</CardTitle>
                  </div>
                  <Badge variant={isLow ? "warning" : "success"}>
                    {isLow ? (
                      <span className="flex items-center gap-1"><AlertTriangle className="h-3 w-3" /> ใกล้หมด</span>
                    ) : (
                      <span className="flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> ปกติ</span>
                    )}
                  </Badge>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">คงเหลือในคลัง:</span>
                    <span className={`font-bold ${isLow ? "text-amber-600 text-base" : ""}`}>{mat.stockQuantity} ชิ้น</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">ราคาต่อหน่วย:</span>
                    <span>{Number(mat.price).toLocaleString()} บาท</span>
                  </div>
                  <div className="pt-2 border-t flex justify-end">
                    <Button size="sm" variant="outline" onClick={() => setRestockMaterial(mat)} className="gap-1.5 text-xs">
                      <ShoppingCart className="h-3.5 w-3.5" /> สั่งซื้อ/เติมสต็อก
                    </Button>
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
