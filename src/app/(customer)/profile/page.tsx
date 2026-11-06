// src/app/(customer)/profile/page.tsx
// ลูกค้าแก้ไขข้อมูลติดต่อของตัวเอง + เปลี่ยนรหัสผ่าน
"use client";

import { useEffect, useState } from "react";
import { Loader2, UserCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ChangePasswordCard } from "@/components/account/change-password-card";
import { thDate } from "@/lib/labels";

type Profile = {
  username: string;
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string | null;
  taxId: string | null;
  createdAt: string;
};

type Form = {
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  taxId: string;
};

const toForm = (p: Profile): Form => ({
  customerName: p.customerName,
  customerAddress: p.customerAddress,
  customerPhone: p.customerPhone,
  customerEmail: p.customerEmail ?? "",
  taxId: p.taxId ?? "",
});

export default function ProfilePage() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [form, setForm] = useState<Form | null>(null);
  const [errors, setErrors] = useState<Partial<Record<keyof Form, string[]>>>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/profile")
      .then((r) => r.json())
      .then((d) => {
        if (d.success) {
          setProfile(d.data);
          setForm(toForm(d.data));
        } else setLoadError(d.message ?? "โหลดข้อมูลไม่สำเร็จ");
      })
      .catch(() => setLoadError("โหลดข้อมูลไม่สำเร็จ"));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form) return;
    setSaving(true);
    setMsg(null);
    setErrors({});
    try {
      const res = await fetch("/api/profile", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(d.errors ?? {});
        setMsg({ ok: false, text: d.message ?? "บันทึกไม่สำเร็จ" });
        return;
      }
      setProfile(d.data);
      setForm(toForm(d.data));
      setMsg({ ok: true, text: d.message ?? "บันทึกข้อมูลสำเร็จ" });
    } catch {
      setMsg({ ok: false, text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setSaving(false);
    }
  };

  if (loadError) {
    return <div className="p-4 bg-destructive/10 text-destructive text-sm rounded-md border border-destructive/30">{loadError}</div>;
  }
  if (!profile || !form) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const input = (id: keyof Form, label: string, props: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={form[id]} onChange={(e) => setForm({ ...form, [id]: e.target.value })} {...props} />
      {errors[id]?.[0] && <p className="text-xs text-destructive">{errors[id]![0]}</p>}
    </div>
  );

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ข้อมูลของฉัน</h1>
        <p className="text-muted-foreground">
          Username: <span className="font-medium text-foreground">{profile.username}</span> · สมาชิกตั้งแต่ {thDate(profile.createdAt)}
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <UserCircle className="h-4 w-4" /> ข้อมูลติดต่อ
          </CardTitle>
          <CardDescription>ใช้สำหรับติดต่อนัดหมาย ส่งอีเมลแจ้งเตือน และออกใบเสนอราคา/ใบแจ้งหนี้</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={submit} className="space-y-4">
            {msg && (
              <div
                className={`rounded-md px-3 py-2 text-sm ${
                  msg.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-destructive/10 text-destructive border border-destructive/30"
                }`}
              >
                {msg.text}
              </div>
            )}
            {input("customerName", "ชื่อ-นามสกุล / ชื่อบริษัท", { required: true, maxLength: 100 })}
            <div className="space-y-1.5">
              <Label htmlFor="customerAddress">ที่อยู่</Label>
              <textarea
                id="customerAddress"
                className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                value={form.customerAddress}
                onChange={(e) => setForm({ ...form, customerAddress: e.target.value })}
                required
                maxLength={500}
              />
              {errors.customerAddress?.[0] && <p className="text-xs text-destructive">{errors.customerAddress[0]}</p>}
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {input("customerPhone", "เบอร์โทร", { required: true, inputMode: "numeric", maxLength: 10, placeholder: "0812345678" })}
              {input("customerEmail", "อีเมล", { type: "email", placeholder: "name@example.com" })}
            </div>
            {input("taxId", "เลขประจำตัวผู้เสียภาษี (ถ้ามี)", { maxLength: 20 })}
            <div className="flex gap-2">
              <Button type="submit" disabled={saving}>
                {saving && <Loader2 className="h-4 w-4 animate-spin" />} บันทึกข้อมูล
              </Button>
              <Button type="button" variant="ghost" onClick={() => { setForm(toForm(profile)); setErrors({}); setMsg(null); }}>
                ยกเลิกการแก้ไข
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <ChangePasswordCard />
    </div>
  );
}
