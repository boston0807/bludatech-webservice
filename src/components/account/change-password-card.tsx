// src/components/account/change-password-card.tsx — ฟอร์มเปลี่ยนรหัสผ่าน (ใช้ได้ทุกบทบาท)
"use client";

import { useState } from "react";
import { KeyRound, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

type FieldErrors = Partial<Record<"currentPassword" | "newPassword" | "confirmPassword", string[]>>;

export function ChangePasswordCard() {
  const [form, setForm] = useState({ currentPassword: "", newPassword: "", confirmPassword: "" });
  const [errors, setErrors] = useState<FieldErrors>({});
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  const set = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    setErrors({});
    if (form.newPassword !== form.confirmPassword) {
      setErrors({ confirmPassword: ["รหัสผ่านใหม่ไม่ตรงกัน"] });
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const d = await res.json();
      if (!res.ok) {
        setErrors(d.errors ?? {});
        setMsg({ ok: false, text: d.message ?? "เปลี่ยนรหัสผ่านไม่สำเร็จ" });
        return;
      }
      setForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setMsg({ ok: true, text: d.message ?? "เปลี่ยนรหัสผ่านสำเร็จ" });
    } catch {
      setMsg({ ok: false, text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
    } finally {
      setSaving(false);
    }
  };

  const field = (id: keyof typeof form, label: string, autoComplete: string) => (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} type="password" autoComplete={autoComplete} value={form[id]} onChange={set(id)} required />
      {errors[id]?.[0] && <p className="text-xs text-destructive">{errors[id]![0]}</p>}
    </div>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base flex items-center gap-2">
          <KeyRound className="h-4 w-4" /> เปลี่ยนรหัสผ่าน
        </CardTitle>
        <CardDescription>รหัสผ่านใหม่ต้องมีอย่างน้อย 8 ตัวอักษร</CardDescription>
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
          {field("currentPassword", "รหัสผ่านปัจจุบัน", "current-password")}
          {field("newPassword", "รหัสผ่านใหม่", "new-password")}
          {field("confirmPassword", "ยืนยันรหัสผ่านใหม่", "new-password")}
          <Button type="submit" disabled={saving}>
            {saving && <Loader2 className="h-4 w-4 animate-spin" />} บันทึกรหัสผ่านใหม่
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

/** หน้าบัญชีของพนักงาน (ธุรการ/บัญชี/ช่าง) */
export function StaffAccountPage() {
  return (
    <div className="max-w-xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">บัญชีของฉัน</h1>
        <p className="text-muted-foreground">จัดการรหัสผ่านสำหรับเข้าสู่ระบบ</p>
      </div>
      <ChangePasswordCard />
    </div>
  );
}
