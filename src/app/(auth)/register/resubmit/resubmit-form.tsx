// src/app/(auth)/register/resubmit/resubmit-form.tsx
// ลูกค้าที่ไม่ผ่านการอนุมัติ แก้ไขข้อมูลตามเหตุผลแล้วส่งให้ธุรการตรวจสอบใหม่ (BP ข้อ 5 → 4)
"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { LocationPicker } from "@/components/location-picker";

type Profile = {
  customerName: string;
  customerAddress: string;
  customerPhone: string;
  customerEmail: string;
  taxId: string;
};

export function ResubmitForm() {
  const searchParams = useSearchParams();
  const [username, setUsername] = useState(searchParams.get("username") ?? "");
  const [password, setPassword] = useState("");
  const [profile, setProfile] = useState<Profile | null>(null);
  const [rejectNote, setRejectNote] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  const post = async (body: object) => {
    const res = await fetch("/api/auth/resubmit", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    return res.json();
  };

  const verify = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const d = await post({ mode: "verify", username, password });
      if (!d.success) return setError(d.message ?? "ยืนยันตัวตนไม่สำเร็จ");
      const { rejectNote: note, ...rest } = d.data;
      setRejectNote(note);
      setProfile({
        customerName: rest.customerName,
        customerAddress: rest.customerAddress,
        customerPhone: rest.customerPhone,
        customerEmail: rest.customerEmail,
        taxId: rest.taxId,
      });
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);
    setError(null);
    setFieldErrors({});
    try {
      const d = await post({ mode: "submit", username, password, ...profile });
      if (!d.success) {
        setError(d.message ?? "ส่งข้อมูลไม่สำเร็จ");
        if (d.errors) setFieldErrors(d.errors);
        return;
      }
      setDone(true);
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setLoading(false);
    }
  };

  const field = (key: keyof Profile, label: string, placeholder?: string) => (
    <div className="space-y-2">
      <Label htmlFor={key}>{label}</Label>
      <Input
        id={key}
        value={profile?.[key] ?? ""}
        placeholder={placeholder}
        onChange={(e) => setProfile((p) => (p ? { ...p, [key]: e.target.value } : p))}
      />
      {fieldErrors[key]?.[0] && <p className="text-destructive text-xs">{fieldErrors[key][0]}</p>}
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="bg-primary/10 rounded-full p-3">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">แก้ไขข้อมูลและส่งใหม่</CardTitle>
          <CardDescription>สำหรับบัญชีที่ยังไม่ผ่านการอนุมัติจากเจ้าหน้าที่</CardDescription>
        </CardHeader>

        {done ? (
          <CardContent className="space-y-4 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-600 mx-auto" />
            <p>ส่งข้อมูลให้เจ้าหน้าที่ตรวจสอบอีกครั้งแล้ว กรุณารอการอนุมัติ (จะแจ้งผลทางอีเมลถ้ามี)</p>
            <Link href="/login">
              <Button variant="outline">กลับหน้าเข้าสู่ระบบ</Button>
            </Link>
          </CardContent>
        ) : !profile ? (
          <form onSubmit={verify}>
            <CardContent className="space-y-4">
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">{error}</div>
              )}
              <p className="text-sm text-muted-foreground">ยืนยันตัวตนด้วย Username และรหัสผ่านที่ใช้สมัคร</p>
              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input id="username" value={username} autoComplete="username" onChange={(e) => setUsername(e.target.value)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">รหัสผ่าน</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  autoComplete="current-password"
                  onChange={(e) => setPassword(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex flex-col gap-3">
              <Button type="submit" className="w-full" disabled={loading || !username || !password}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} ถัดไป
              </Button>
              <Link href="/login" className="text-sm text-muted-foreground hover:underline">
                กลับหน้าเข้าสู่ระบบ
              </Link>
            </CardFooter>
          </form>
        ) : (
          <form onSubmit={submit}>
            <CardContent className="space-y-4">
              {rejectNote && (
                <div className="bg-amber-50 border border-amber-300 text-amber-800 text-sm rounded-md px-4 py-3">
                  <span className="font-medium">เหตุผลที่ยังไม่อนุมัติ:</span> {rejectNote}
                </div>
              )}
              {error && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">{error}</div>
              )}
              {field("customerName", "ชื่อ-นามสกุล / ชื่อหน่วยงาน")}
              <LocationPicker
                label="ที่อยู่"
                required
                value={profile.customerAddress}
                onChange={(address) => setProfile((p) => (p ? { ...p, customerAddress: address } : p))}
                error={fieldErrors.customerAddress?.[0]}
              />
              {field("customerPhone", "เบอร์โทรศัพท์", "0812345678")}
              {field("customerEmail", "อีเมล (ถ้ามี)")}
              {field("taxId", "เลขประจำตัวผู้เสียภาษี (ถ้ามี)")}
            </CardContent>
            <CardFooter>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />} ส่งข้อมูลให้ตรวจสอบใหม่
              </Button>
            </CardFooter>
          </form>
        )}
      </Card>
    </div>
  );
}
