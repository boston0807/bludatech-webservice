// src/app/technician/jobs/[id]/survey/page.tsx
"use client";

import { useEffect, useState, use } from "react";
import { useRouter } from "next/navigation";
import { useForm, useFieldArray } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Plus, Trash2, ClipboardCheck, MapPin, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AttachmentGallery, AttachmentUploader } from "@/components/attachments";
import type { AttachmentInfo } from "@/lib/upload-client";

type Job = {
  id: string;
  jobType: string;
  jobAddress: string;
  jobNote?: string | null;
  status: string;
  expenses?: { expenseName: string; quantity: number; price: string }[];
  customer?: { customerName: string };
  installation?: { buildingFloor: number; elevatorBrand?: string; elevatorModel?: string };
  repair?: { elevatorModel?: string };
  service?: { elevatorModel?: string };
};

const surveyFormSchema = z
  .object({
    method: z.enum(["ONSITE", "REMOTE"]),
    note: z.string().optional(),
    noMaterials: z.boolean(),
    expenses: z.array(
      z.object({
        expenseName: z.string().min(1, "กรุณากรอกชื่อรายการ"),
        quantity: z.coerce.number().int().min(1, "ต้องมากกว่า 0"),
        price: z.coerce.number().min(0, "ราคาต้องไม่ติดลบ"),
      })
    ),
  })
  .superRefine((data, ctx) => {
    if (data.method === "REMOTE" && !data.note?.trim()) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["note"],
        message: "การประเมินแบบไม่ลงพื้นที่ต้องระบุข้อมูลที่ใช้ประเมิน",
      });
    }
    if (!data.noMaterials && data.expenses.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["expenses"],
        message: "กรุณาเพิ่มรายการอย่างน้อย 1 รายการ หรือเลือก \"ไม่ต้องใช้อะไหล่/วัสดุ\"",
      });
    }
  });

type SurveyFormData = z.infer<typeof surveyFormSchema>;

export default function SurveyPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const [job, setJob] = useState<Job | null>(null);
  const [loading, setLoading] = useState(true);
  const [serverError, setServerError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [photos, setPhotos] = useState<AttachmentInfo[]>([]);

  const { register, handleSubmit, control, watch, formState: { errors, isSubmitting } } = useForm<SurveyFormData>({
    resolver: zodResolver(surveyFormSchema),
    defaultValues: { method: "ONSITE", noMaterials: false, expenses: [{ expenseName: "", quantity: 1, price: 0 }] },
  });

  const { fields, append, remove, replace } = useFieldArray({ control, name: "expenses" });
  const noMaterials = watch("noMaterials");
  const method = watch("method");

  const noMaterialsField = register("noMaterials", {
    onChange: (e) => {
      if (e.target.checked) replace([]);
      else replace([{ expenseName: "", quantity: 1, price: 0 }]);
    },
  });

  useEffect(() => {
    fetch(`/api/jobs/${id}`)
      .then((r) => r.json())
      .then((d) => {
        if (!d.success) return;
        setJob(d.data);
        // สำรวจใหม่หลังลูกค้าขอแก้ไข → ดึงรายการประเมินเดิมมาให้แก้ต่อ
        if (d.data.status === "REQUEST_EDIT" && d.data.expenses?.length) {
          replace(
            d.data.expenses.map((e: { expenseName: string; quantity: number; price: string }) => ({
              expenseName: e.expenseName,
              quantity: e.quantity,
              price: Number(e.price),
            }))
          );
        }
      })
      .finally(() => setLoading(false));
  }, [id, replace]);

  const onSubmit = async (data: SurveyFormData) => {
    setServerError(null);
    try {
      // บันทึกผลสำรวจและรายการอะไหล่ในครั้งเดียว (UC05) — ถ้าพังจะไม่บันทึกอะไรเลย
      const validExpenses = data.noMaterials ? [] : data.expenses.filter((e) => e.expenseName.trim());
      const surveyRes = await fetch(`/api/jobs/${id}/survey`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          method: data.method,
          note: data.note,
          expenses: validExpenses,
          attachmentIds: photos.map((p) => p.id),
        }),
      });
      if (!surveyRes.ok) {
        const e = await surveyRes.json();
        setServerError(e.message ?? "บันทึกการสำรวจไม่สำเร็จ");
        return;
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
        {/* วิธีประเมิน — ลดการลงพื้นที่ที่ไม่จำเป็น (ปัญหา BP ข้อ 2) */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">วิธีประเมินหน้างาน</CardTitle>
            <CardDescription>
              งานซ่อม/บำรุงที่ลูกค้าแจ้งอาการชัดเจน ประเมินจากข้อมูลได้โดยไม่ต้องเดินทาง ช่วยประหยัดเวลาและค่าเดินทางของช่าง
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {job.jobNote && (
              <div className="rounded-md bg-muted px-3 py-2 text-sm">
                <span className="text-muted-foreground">ข้อมูลที่ลูกค้าแจ้ง: </span>
                {job.jobNote}
              </div>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              <label className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm cursor-pointer ${method === "ONSITE" ? "border-primary bg-primary/5" : ""}`}>
                <input type="radio" value="ONSITE" className="mt-1 accent-primary" disabled={alreadySurveyed} {...register("method")} />
                <span>
                  <span className="font-medium flex items-center gap-1"><MapPin className="h-4 w-4" /> ลงพื้นที่สำรวจ</span>
                  <span className="text-xs text-muted-foreground">วัดขนาด ตรวจสภาพจริงที่หน้างาน</span>
                </span>
              </label>
              <label className={`flex items-start gap-3 rounded-md border px-3 py-2 text-sm ${job.jobType === "INSTALLATION" ? "opacity-50 cursor-not-allowed" : "cursor-pointer"} ${method === "REMOTE" ? "border-primary bg-primary/5" : ""}`}>
                <input
                  type="radio"
                  value="REMOTE"
                  className="mt-1 accent-primary"
                  disabled={alreadySurveyed || job.jobType === "INSTALLATION"}
                  {...register("method")}
                />
                <span>
                  <span className="font-medium flex items-center gap-1"><PhoneCall className="h-4 w-4" /> ประเมินโดยไม่ลงพื้นที่</span>
                  <span className="text-xs text-muted-foreground">
                    {job.jobType === "INSTALLATION" ? "งานติดตั้งต้องลงพื้นที่เสมอ" : "จากอาการที่ลูกค้าแจ้ง โทรสอบถาม หรือประวัติการซ่อม"}
                  </span>
                </span>
              </label>
            </div>
          </CardContent>
        </Card>

        {/* หมายเหตุการสำรวจ */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">ผลการสำรวจ</CardTitle>
            <CardDescription>สรุปสภาพหน้างาน ข้อสังเกต หรือปัญหาที่พบ</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="note">{method === "REMOTE" ? "ข้อมูลที่ใช้ประเมิน (จำเป็น)" : "บันทึกการสำรวจ"}</Label>
              <textarea
                id="note"
                className="flex min-h-24 w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50"
                placeholder="อธิบายสภาพหน้างาน ขนาดบ่อลิฟต์ ปัญหาที่พบ ฯลฯ"
                disabled={alreadySurveyed}
                {...register("note")}
              />
              {errors.note && <p className="text-destructive text-xs">{errors.note.message}</p>}
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
              {!alreadySurveyed && !noMaterials && (
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
            <label className="flex items-center gap-2 text-sm cursor-pointer select-none w-fit">
              <input
                type="checkbox"
                className="h-4 w-4 rounded border-input accent-primary"
                disabled={alreadySurveyed}
                {...noMaterialsField}
              />
              ไม่ต้องใช้อะไหล่/วัสดุ
            </label>

            {errors.expenses?.root?.message || errors.expenses?.message ? (
              <p className="text-destructive text-xs">
                {errors.expenses?.root?.message ?? errors.expenses?.message}
              </p>
            ) : null}

            {!noMaterials && (
            <>
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
            </>
            )}
          </CardContent>
        </Card>

        {/* รูปถ่ายหน้างาน — หลักฐานสภาพก่อนเริ่มงาน ใช้ประกอบการประเมินราคา */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">รูปถ่ายหน้างาน</CardTitle>
            <CardDescription>ถ่ายสภาพลิฟต์ / บ่อลิฟต์ / จุดที่ชำรุด เพื่อใช้ประเมินราคาและเป็นหลักฐาน</CardDescription>
          </CardHeader>
          <CardContent>
            {alreadySurveyed ? (
              <AttachmentGallery jobId={id} categories={["SURVEY"]} emptyText="ไม่มีรูปถ่ายจากการสำรวจ" />
            ) : (
              <AttachmentUploader jobId={id} category="SURVEY" value={photos} onChange={setPhotos} disabled={isSubmitting} />
            )}
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
