// src/app/(auth)/register/page.tsx
"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import Link from "next/link";
import { Loader2, Building2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { registerSchema, type RegisterInput } from "@/lib/validations/auth";

export default function RegisterPage() {
  const router = useRouter();
  const [success, setSuccess] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
  });

  const onSubmit = async (data: RegisterInput) => {
    setServerError(null);
    try {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      const result = await res.json();

      if (!res.ok) {
        setServerError(result.message ?? "เกิดข้อผิดพลาด");
        return;
      }

      setSuccess(true);
    } catch {
      setServerError("เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง");
    }
  };

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
        <Card className="w-full max-w-md shadow-lg text-center">
          <CardHeader className="space-y-3">
            <div className="flex justify-center">
              <div className="bg-green-100 rounded-full p-3">
                <CheckCircle2 className="h-8 w-8 text-green-600" />
              </div>
            </div>
            <CardTitle className="text-2xl text-green-700">ลงทะเบียนสำเร็จ!</CardTitle>
            <CardDescription>
              ข้อมูลของคุณถูกบันทึกแล้ว กรุณารอการอนุมัติจากเจ้าหน้าที่
              เราจะแจ้งให้ทราบทางอีเมลเมื่ออนุมัติแล้ว
            </CardDescription>
          </CardHeader>
          <CardFooter className="justify-center">
            <Button onClick={() => router.push("/login")} variant="outline">
              กลับหน้าเข้าสู่ระบบ
            </Button>
          </CardFooter>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-blue-100 flex items-center justify-center p-4">
      <Card className="w-full max-w-lg shadow-lg">
        <CardHeader className="text-center space-y-3">
          <div className="flex justify-center">
            <div className="bg-primary/10 rounded-full p-3">
              <Building2 className="h-8 w-8 text-primary" />
            </div>
          </div>
          <CardTitle className="text-2xl">สมัครสมาชิก</CardTitle>
          <CardDescription>สร้างบัญชีเพื่อใช้บริการซ่อมบำรุงลิฟต์</CardDescription>
        </CardHeader>

        <form onSubmit={handleSubmit(onSubmit)}>
          <CardContent className="space-y-4">
            {serverError && (
              <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
                {serverError}
              </div>
            )}

            {/* Account Info */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ข้อมูลบัญชี
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="username">Username <span className="text-destructive">*</span></Label>
                  <Input id="username" placeholder="ชื่อผู้ใช้งาน (a-z, A-Z, 0-9, _)" {...register("username")} />
                  {errors.username && <p className="text-destructive text-xs">{errors.username.message}</p>}
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="password">รหัสผ่าน <span className="text-destructive">*</span></Label>
                    <Input id="password" type="password" placeholder="อย่างน้อย 8 ตัวอักษร" {...register("password")} />
                    {errors.password && <p className="text-destructive text-xs">{errors.password.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">ยืนยันรหัสผ่าน <span className="text-destructive">*</span></Label>
                    <Input id="confirmPassword" type="password" placeholder="กรอกรหัสผ่านอีกครั้ง" {...register("confirmPassword")} />
                    {errors.confirmPassword && <p className="text-destructive text-xs">{errors.confirmPassword.message}</p>}
                  </div>
                </div>
              </div>
            </div>

            {/* Personal Info */}
            <div className="space-y-1">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                ข้อมูลส่วนตัว
              </p>
              <div className="grid grid-cols-1 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="customerName">ชื่อ-นามสกุล / ชื่อบริษัท <span className="text-destructive">*</span></Label>
                  <Input id="customerName" placeholder="กรอกชื่อ-นามสกุล หรือชื่อบริษัท" {...register("customerName")} />
                  {errors.customerName && <p className="text-destructive text-xs">{errors.customerName.message}</p>}
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="customerPhone">เบอร์โทร <span className="text-destructive">*</span></Label>
                    <Input id="customerPhone" placeholder="06x-08x-09x (10 หลัก)" {...register("customerPhone")} />
                    {errors.customerPhone && <p className="text-destructive text-xs">{errors.customerPhone.message}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="customerEmail">อีเมล</Label>
                    <Input id="customerEmail" type="email" placeholder="example@email.com" {...register("customerEmail")} />
                    {errors.customerEmail && <p className="text-destructive text-xs">{errors.customerEmail.message}</p>}
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="taxId">เลขผู้เสียภาษี</Label>
                  <Input id="taxId" placeholder="กรอกเลขประจำตัวผู้เสียภาษี (ถ้ามี)" {...register("taxId")} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="customerAddress">ที่อยู่ <span className="text-destructive">*</span></Label>
                  <Input id="customerAddress" placeholder="กรอกที่อยู่" {...register("customerAddress")} />
                  {errors.customerAddress && <p className="text-destructive text-xs">{errors.customerAddress.message}</p>}
                </div>
              </div>
            </div>
          </CardContent>

          <CardFooter className="flex flex-col gap-3">
            <Button type="submit" className="w-full" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              สมัครสมาชิก
            </Button>
            <p className="text-sm text-muted-foreground text-center">
              มีบัญชีแล้ว?{" "}
              <Link href="/login" className="text-primary hover:underline font-medium">
                เข้าสู่ระบบ
              </Link>
            </p>
          </CardFooter>
        </form>
      </Card>
    </div>
  );
}
