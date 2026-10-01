// src/app/technician/jobs/[id]/survey/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, ClipboardCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

type Job = {
  id: string;
  jobType: string;
  jobAddress: string;
  status: string;
  customer?: { customerName: string };
  installation?: { buildingFloor: number; elevatorBrand?: string; elevatorModel?: string };
  repair?: { elevatorModel?: string };
  service?: { elevatorModel?: string };
};

const surveyFormSchema = z.object({
  note: z.string().optional(),
  expenses: z.array(
    z.object({
      expenseName: z.string().min(1, "กรุณากรอกชื่อรายการ"),
      quantity: z.coerce.number().int().min(1, "ต้องมากกว่า 0"),
      price: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
    })
  ),
});

type SurveyFormData = z.infer<typeof surveyFormSchema>;

export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const { register, handleSubmit, control, formState: { errors, isSubmitting } } = useForm<SurveyFormData>({
    resolver: zodResolver(surveyFormSchema),
    defaultValues: { expenses: [{ expenseName: "", quantity: 1, price: 0 }] },
  });

  const { fields, append, remove } = useFieldArray({ control, name: "expenses" });

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((d) => { if (d.success) setJob(d.data); })
      .finally(() => setLoading(false));
  }, [id]);

  const onSubmit = async (data: SurveyFormData) => {
    setServerError(null);
    try {
      // 1. บันทึก survey
      const surveyRes = await fetch(`/api/jobs/${id}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ note: data.note }),
      });
      if (!surveyRes.ok) {
        const e = await surveyRes.json();
        setServerError(e.message ?? "บันทึกการสำรวจไม่สำเร็จ");
        return;
      }

      // 2. บันทึก expenses (ถ้ามี)
      const validExpenses = data.expenses.filter((e) => e.expenseName.trim());
      if (validExpenses.length > 0) {
        const expRes = await fetch(`/api/jobs/${id}/expenses`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ expenses: validExpenses }),
        });
        if (!expRes.ok) {
          const e = await expRes.json();
          setServerError(e.message ?? "บันทึกรายการค่าใช้จ่ายไม่สำเร็จ");
          return;
        }
      }

      setSuccess(true);
      setTimeout(() => router.push("/technician/jobs"), 1500);
    } catch {
      setServerError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (!job) return <div className="text-center py-20 text-muted-foreground">ไม่พบใบงาน</div>;

  const alreadySurveyed = job.status !== "PENDING" && job.status !== "REQUEST_EDIT";

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Job Info */}
      <div>
        <div className="flex items-center gap-3 mb-1">
          <h1 className="text-2xl font-bold tracking-tight">บันทึกการสำรวจหน้างาน</h1>
          <Badge variant={alreadySurveyed ? "secondary" : "warning"}>
            {alreadySurveyed ? "สำรวจแล้ว" : "รอสำรวจ"}
          </Badge>
        </div>
        <p className="text-muted-foreground">{job.customer?.customerName} — {job.jobAddress}</p>
      </div>

      {alreadySurveyed && (
        <div className="bg-blue-50 border border-blue-200 text-blue-700 rounded-md px-4 py-3 text-sm">
          ใบงานนี้ผ่านการสำรวจแล้ว ไม่สามารถบันทึกซ้ำได้
        </div>
      )}

      {success && (
        <div className="bg-green-50 border border-green-200 text-green-700 rounded-md px-4 py-3 text-sm flex items-center gap-2">
          <ClipboardCheck className="h-4 w-4" />
          บันทึกการสำรวจสำเร็จ กำลังกลับไปหน้ารายการ...
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
        {/* หมายเหตุการสำรวจ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ผลการสำรวจ</CardTitle>
            <CardDescription>สรุปสภาพหน้างาน ข้อสังเกต หรือปัญหาที่พบ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="note">บันทึกการสำรวจ</Label>
              <textarea
                id="note"
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="อธิบายสภาพหน้างาน ขนาดบ่อลิฟต์ ปัญหาที่พบ ฯลฯ"
                disabled={alreadySurveyed}
                {...register("note")}
              />
            </div>
          </CardContent>
        </Card>

        {/* รายการค่าใช้จ่าย */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-base">รายการอะไหล่ / ค่าใช้จ่าย</CardTitle>
                <CardDescription>ประเมินวัสดุและอะไหล่ที่ต้องใช้</CardDescription>
              </div>
              {!alreadySurveyed && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => append({ expenseName: "", quantity: 1, price: 0 })}
                >
                  <Plus className="h-4 w-4" />
                  เพิ่มรายการ
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {/* Header row */}
            <div className="grid grid-cols-12 gap-2 text-xs font-medium text-muted-foreground px-1">
              <span className="col-span-6">ชื่อรายการ</span>
              <span className="col-span-2 text-center">จำนวน</span>
              <span className="col-span-3 text-center">ราคา/หน่วย</span>
              <span className="col-span-1" />
            </div>

            {fields.map((field, i) => (
              <div key={field.id} className="grid grid-cols-12 gap-2 items-center">
                <div className="col-span-6">
                  <Input
                    placeholder="ชื่ออะไหล่/วัสดุ"
                    disabled={alreadySurveyed}
                    {...register(`expenses.${i}.expenseName`)}
                  />
                  {errors.expenses?.[i]?.expenseName && (
                    <p className="text-destructive text-xs mt-1">{errors.expenses[i].expenseName?.message}</p>
                  )}
                </div>
                <div className="col-span-2">
                  <Input
                    type="number"
                    min={1}
                    disabled={alreadySurveyed}
                    {...register(`expenses.${i}.quantity`)}
                  />
                </div>
                <div className="col-span-3">
                  <Input
                    type="number"
                    min={0}
                    step="0.01"
                    placeholder="0.00"
                    disabled={alreadySurveyed}
                    {...register(`expenses.${i}.price`)}
                  />
                </div>
                <div className="col-span-1 flex justify-center">
                  {!alreadySurveyed && fields.length > 1 && (
                    <Button type="button" variant="ghost" size="icon" onClick={() => remove(i)} className="h-8 w-8 text-destructive">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </CardContent>
        </Card>

        {serverError && (
          <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
            {serverError}
          </div>
        )}

        {!alreadySurveyed && (
          <div className="flex gap-3">
            <Button type="submit" disabled={isSubmitting} className="flex-1">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              บันทึกการสำรวจ
            </Button>
            <Button type="button" variant="outline" onClick={() => router.back()}>
              ยกเลิก
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}
