// src/app/(customer)/jobs/new/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Building2, Wrench, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { createJobSchema, type CreateJobInput } from "@/lib/validations/job";
import { cn } from "@/lib/utils";
import { LocationPicker } from "@/components/location-picker";

type ElevatorType = { id: string; name: string };
type ElevatorModel = { id: string; brand: string; name: string; typeId: string; type: ElevatorType };

const OTHER = "__other__"; // ลิฟต์ที่ไม่มีในระบบ → ให้พิมพ์เอง

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

const JOB_TYPES = [
  { value: "INSTALLATION", label: "ติดตั้งลิฟต์", desc: "ติดตั้งลิฟต์ใหม่สำหรับอาคาร", icon: Building2 },
  { value: "REPAIR", label: "ซ่อมรายครั้ง", desc: "แก้ไขและซ่อมแซมลิฟต์ที่ขัดข้อง", icon: Wrench },
  { value: "SERVICE", label: "บำรุงรักษารายเดือน", desc: "ตรวจสอบและบำรุงรักษาตามกำหนด", icon: Settings },
] as const;

export default function NewJobPage() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<"INSTALLATION" | "REPAIR" | "SERVICE" | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  // ข้อมูลลิฟต์ที่ธุรการบันทึกไว้ (หน้า ข้อมูลลิฟต์)
  const [elevatorTypes, setElevatorTypes] = useState<ElevatorType[]>([]);
  const [elevatorModels, setElevatorModels] = useState<ElevatorModel[]>([]);
  const [typeChoice, setTypeChoice] = useState("");
  const [modelChoice, setModelChoice] = useState("");

  useEffect(() => {
    Promise.all([
      fetch("/api/elevators/types").then((r) => r.json()),
      fetch("/api/elevators/models").then((r) => r.json()),
    ])
      .then(([t, m]) => {
        if (t.success) setElevatorTypes(t.data);
        if (m.success) setElevatorModels(m.data);
      })
      .catch(() => {
        // โหลดไม่ได้ → ใช้ช่องพิมพ์เองแทน
      });
  }, []);

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<CreateJobInput>({
    resolver: zodResolver(createJobSchema),
    defaultValues: { quantity: 1, jobAddress: "" },
  });
  const jobAddress = watch("jobAddress");

  const setField = (name: "elevatorBrand" | "elevatorModel" | "elevatorType", value: string | undefined) =>
    setValue(name as keyof CreateJobInput, value as never);

  // งานติดตั้งกรองรุ่นตามประเภทที่เลือก
  const modelOptions = useMemo(
    () =>
      selectedType === "INSTALLATION" && typeChoice
        ? elevatorModels.filter((m) => m.typeId === typeChoice)
        : elevatorModels,
    [elevatorModels, selectedType, typeChoice]
  );
  const hasCatalog = elevatorModels.length > 0 || elevatorTypes.length > 0;

  // เลือกรุ่นจากระบบ → เติมยี่ห้อ/รุ่น/ประเภทให้อัตโนมัติ
  const chooseModel = (id: string) => {
    setModelChoice(id);
    const m = elevatorModels.find((x) => x.id === id);
    if (selectedType === "INSTALLATION") {
      setField("elevatorBrand", m?.brand);
      setField("elevatorModel", m?.name);
      if (m) {
        setTypeChoice(m.typeId);
        setField("elevatorType", m.type.name);
      }
    } else {
      setField("elevatorModel", m ? `${m.brand} ${m.name}` : undefined);
    }
  };

  const chooseType = (id: string) => {
    setTypeChoice(id);
    setField("elevatorType", elevatorTypes.find((t) => t.id === id)?.name);
    // รุ่นที่เลือกไว้ไม่ตรงประเภทใหม่ → ล้าง
    const current = elevatorModels.find((m) => m.id === modelChoice);
    if (current && id && current.typeId !== id) chooseModel("");
  };

  const handleSelectType = (type: "INSTALLATION" | "REPAIR" | "SERVICE") => {
    setSelectedType(type);
    setValue("jobType", type);
    // ประเภทงานเปลี่ยน → รูปแบบเก็บรุ่นลิฟต์ต่างกัน จึงเริ่มเลือกใหม่
    setTypeChoice("");
    setModelChoice("");
    setField("elevatorBrand", undefined);
    setField("elevatorModel", undefined);
    setField("elevatorType", undefined);
  };

  const onSubmit = async (data: CreateJobInput) => {
    setServerError(null);
    try {
      const res = await fetch("/api/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await res.json();
      if (!res.ok) {
        setServerError(result.message ?? "เกิดข้อผิดพลาด");
        return;
      }
      router.push(`/jobs/${result.data.id}`);
    } catch {
      setServerError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ยื่นคำขอบริการ</h1>
        <p className="text-muted-foreground">เลือกประเภทบริการและกรอกข้อมูล</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* เลือกประเภทงาน */}
        <div className="space-y-3">
          <Label>ประเภทบริการ <span className="text-destructive">*</span></Label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {JOB_TYPES.map(({ value, label, desc, icon: Icon }) => (
              <button
                key={value}
                type="button"
                onClick={() => handleSelectType(value)}
                className={cn(
                  "flex flex-col items-center gap-2 p-4 rounded-lg border-2 text-center transition-all",
                  selectedType === value
                    ? "border-primary bg-primary/5"
                    : "border-border hover:border-primary/50 hover:bg-accent"
                )}
              >
                <Icon className={cn("h-8 w-8", selectedType === value ? "text-primary" : "text-muted-foreground")} />
                <span className="font-medium text-sm">{label}</span>
                <span className="text-xs text-muted-foreground">{desc}</span>
              </button>
            ))}
          </div>
          {errors.jobType && <p className="text-destructive text-xs">{errors.jobType.message}</p>}
        </div>

        {selectedType && (
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ข้อมูลการขอรับบริการ</CardTitle>
              <CardDescription>
                {selectedType === "INSTALLATION" && "ข้อมูลสำหรับงานติดตั้งลิฟต์"}
                {selectedType === "REPAIR" && "ข้อมูลสำหรับงานซ่อมแซมลิฟต์"}
                {selectedType === "SERVICE" && "ข้อมูลสำหรับงานบำรุงรักษารายเดือน"}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {serverError && (
                <div className="bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-md px-4 py-3">
                  {serverError}
                </div>
              )}

              {/* สถานที่ — เลือกจากแผนที่ */}
              <LocationPicker
                label="สถานที่ปฏิบัติงาน"
                required
                value={jobAddress ?? ""}
                onChange={(address) => setValue("jobAddress", address, { shouldValidate: !!errors.jobAddress })}
                error={errors.jobAddress?.message}
              />

              {/* จำนวนเครื่อง */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="quantity">จำนวนเครื่อง <span className="text-destructive">*</span></Label>
                  <Input
                    id="quantity"
                    type="number"
                    min={1}
                    {...register("quantity", { valueAsNumber: true })}
                  />
                  {errors.quantity && <p className="text-destructive text-xs">{errors.quantity.message}</p>}
                </div>

                {/* รุ่นลิฟต์ — เลือกจากข้อมูลในระบบ หรือพิมพ์เองถ้าไม่มี */}
                <div className="space-y-2">
                  <Label htmlFor="elevatorModelChoice">รุ่นลิฟต์</Label>
                  {hasCatalog ? (
                    <select
                      id="elevatorModelChoice"
                      className={selectClass}
                      value={modelChoice}
                      onChange={(e) => chooseModel(e.target.value)}
                    >
                      <option value="">— ไม่ระบุ / ไม่ทราบ —</option>
                      {modelOptions.map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.brand} {m.name} ({m.type.name})
                        </option>
                      ))}
                      <option value={OTHER}>อื่นๆ (ระบุเอง)</option>
                    </select>
                  ) : (
                    <Input id="elevatorModelChoice" placeholder="เช่น OTIS 3000" {...register("elevatorModel" as keyof CreateJobInput)} />
                  )}
                </div>
              </div>

              {hasCatalog && modelChoice === OTHER && (
                <div className={cn("grid gap-4", selectedType === "INSTALLATION" ? "grid-cols-2" : "grid-cols-1")}>
                  {selectedType === "INSTALLATION" && (
                    <div className="space-y-2">
                      <Label htmlFor="elevatorBrand">ยี่ห้อลิฟต์</Label>
                      <Input id="elevatorBrand" placeholder="เช่น OTIS, KONE" {...register("elevatorBrand" as keyof CreateJobInput)} />
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="elevatorModel">ระบุรุ่นลิฟต์</Label>
                    <Input
                      id="elevatorModel"
                      placeholder={selectedType === "INSTALLATION" ? "เช่น Gen2" : "เช่น OTIS 3000"}
                      {...register("elevatorModel" as keyof CreateJobInput)}
                    />
                  </div>
                </div>
              )}

              {/* เฉพาะ INSTALLATION */}
              {selectedType === "INSTALLATION" && (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="buildingFloor">จำนวนชั้นอาคาร <span className="text-destructive">*</span></Label>
                    <Input
                      id="buildingFloor"
                      type="number"
                      min={1}
                      placeholder="เช่น 10"
                      {...register("buildingFloor" as keyof CreateJobInput, { valueAsNumber: true })}
                    />
                    {(errors as Record<string, { message?: string }>).buildingFloor && (
                      <p className="text-destructive text-xs">{(errors as Record<string, { message?: string }>).buildingFloor?.message}</p>
                    )}
                  </div>
                  {hasCatalog ? (
                    <div className="space-y-2">
                      <Label htmlFor="elevatorTypeChoice">ประเภทลิฟต์</Label>
                      <select
                        id="elevatorTypeChoice"
                        className={selectClass}
                        value={typeChoice}
                        onChange={(e) => chooseType(e.target.value)}
                      >
                        <option value="">— ไม่ระบุ —</option>
                        {elevatorTypes.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    </div>
                  ) : (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="elevatorBrand">ยี่ห้อลิฟต์</Label>
                        <Input id="elevatorBrand" placeholder="เช่น OTIS, KONE" {...register("elevatorBrand" as keyof CreateJobInput)} />
                      </div>
                      <div className="space-y-2 col-span-2">
                        <Label htmlFor="elevatorType">ประเภทลิฟต์</Label>
                        <Input id="elevatorType" placeholder="เช่น Passenger, Freight" {...register("elevatorType" as keyof CreateJobInput)} />
                      </div>
                    </>
                  )}
                </div>
              )}

              {/* หมายเหตุ */}
              <div className="space-y-2">
                <Label htmlFor="jobNote">
                  {selectedType === "INSTALLATION" ? "หมายเหตุ / รายละเอียดเพิ่มเติม" : "อาการที่พบ / รายละเอียดงาน"}
                </Label>
                <textarea
                  id="jobNote"
                  className="flex min-h-20 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  placeholder={
                    selectedType === "INSTALLATION"
                      ? "รายละเอียดเพิ่มเติม (ถ้ามี)"
                      : "เช่น ประตูชั้น 3 ปิดไม่สนิท มีเสียงดังตอนขึ้น เกิดขึ้นตั้งแต่เมื่อไร เป็นทุกครั้งหรือบางครั้ง"
                  }
                  {...register("jobNote")}
                />
                {selectedType !== "INSTALLATION" && (
                  <p className="text-xs text-muted-foreground">
                    ยิ่งอธิบายอาการละเอียด ช่างยิ่งประเมินราคาได้เร็วโดยอาจไม่ต้องนัดเข้าสำรวจหน้างาน
                  </p>
                )}
              </div>

              <div className="flex gap-3 pt-2">
                <Button type="submit" disabled={isSubmitting} className="flex-1">
                  {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
                  ยื่นคำขอบริการ
                </Button>
                <Button type="button" variant="outline" onClick={() => router.back()}>
                  ยกเลิก
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </form>
    </div>
  );
}
