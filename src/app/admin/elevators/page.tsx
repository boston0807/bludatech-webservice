// src/app/admin/elevators/page.tsx
// ข้อมูลหลักลิฟต์ — แท็บ "ประเภทลิฟต์" และ "รุ่นลิฟต์" ให้ธุรการเพิ่ม/แก้ไข/ลบ
// ข้อมูลนี้ใช้เป็นตัวเลือกในหน้ายื่นคำขอบริการของลูกค้า
"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2, Pencil, Plus, Trash2, Layers, Tag, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

type ElevatorType = {
  id: string;
  name: string;
  description: string | null;
  _count: { models: number };
};

type ElevatorModel = {
  id: string;
  brand: string;
  name: string;
  typeId: string;
  description: string | null;
  type: { id: string; name: string };
};

type Tab = "types" | "models";
type Message = { type: "success" | "error"; text: string } | null;

const EMPTY_TYPE = { name: "", description: "" };
const EMPTY_MODEL = { brand: "", name: "", typeId: "", description: "" };

const selectClass =
  "flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export default function ElevatorsPage() {
  const [tab, setTab] = useState<Tab>("types");
  const [types, setTypes] = useState<ElevatorType[]>([]);
  const [models, setModels] = useState<ElevatorModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<Message>(null);

  // ฟอร์ม: editingId = null คือเพิ่มใหม่
  const [typeForm, setTypeForm] = useState(EMPTY_TYPE);
  const [editingTypeId, setEditingTypeId] = useState<string | null>(null);
  const [modelForm, setModelForm] = useState(EMPTY_MODEL);
  const [editingModelId, setEditingModelId] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string[]>>({});

  const load = useCallback(async () => {
    try {
      const [t, m] = await Promise.all([
        fetch("/api/elevators/types").then((r) => r.json()),
        fetch("/api/elevators/models").then((r) => r.json()),
      ]);
      if (t.success) setTypes(t.data);
      if (m.success) setModels(m.data);
      if (!t.success || !m.success) setMessage({ type: "error", text: t.message ?? m.message ?? "โหลดข้อมูลไม่สำเร็จ" });
    } catch {
      setMessage({ type: "error", text: "โหลดข้อมูลไม่สำเร็จ" });
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const send = async (url: string, method: string, body?: object) => {
    setSaving(true);
    setMessage(null);
    setFieldErrors({});
    try {
      const res = await fetch(url, {
        method,
        headers: body ? { "Content-Type": "application/json" } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const d = await res.json();
      if (!d.success) {
        setMessage({ type: "error", text: d.message ?? "บันทึกไม่สำเร็จ" });
        if (d.errors) setFieldErrors(d.errors);
        return false;
      }
      setMessage({ type: "success", text: d.message ?? "บันทึกสำเร็จ" });
      await load();
      return true;
    } catch {
      setMessage({ type: "error", text: "เกิดข้อผิดพลาด กรุณาลองใหม่" });
      return false;
    } finally {
      setSaving(false);
    }
  };

  const switchTab = (next: Tab) => {
    setTab(next);
    setMessage(null);
    setFieldErrors({});
  };

  // ── ประเภทลิฟต์ ──
  const resetTypeForm = () => {
    setTypeForm(EMPTY_TYPE);
    setEditingTypeId(null);
    setFieldErrors({});
  };

  const submitType = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = editingTypeId
      ? await send(`/api/elevators/types/${editingTypeId}`, "PATCH", typeForm)
      : await send("/api/elevators/types", "POST", typeForm);
    if (ok) resetTypeForm();
  };

  const editType = (t: ElevatorType) => {
    setEditingTypeId(t.id);
    setTypeForm({ name: t.name, description: t.description ?? "" });
    setFieldErrors({});
    setMessage(null);
  };

  const deleteType = async (t: ElevatorType) => {
    if (!window.confirm(`ลบประเภท "${t.name}" ใช่หรือไม่?`)) return;
    const ok = await send(`/api/elevators/types/${t.id}`, "DELETE");
    if (ok && editingTypeId === t.id) resetTypeForm();
  };

  // ── รุ่นลิฟต์ ──
  const resetModelForm = () => {
    setModelForm(EMPTY_MODEL);
    setEditingModelId(null);
    setFieldErrors({});
  };

  const submitModel = async (e: React.FormEvent) => {
    e.preventDefault();
    const ok = editingModelId
      ? await send(`/api/elevators/models/${editingModelId}`, "PATCH", modelForm)
      : await send("/api/elevators/models", "POST", modelForm);
    if (ok) resetModelForm();
  };

  const editModel = (m: ElevatorModel) => {
    setEditingModelId(m.id);
    setModelForm({ brand: m.brand, name: m.name, typeId: m.typeId, description: m.description ?? "" });
    setFieldErrors({});
    setMessage(null);
  };

  const deleteModel = async (m: ElevatorModel) => {
    if (!window.confirm(`ลบรุ่น "${m.brand} ${m.name}" ใช่หรือไม่?`)) return;
    const ok = await send(`/api/elevators/models/${m.id}`, "DELETE");
    if (ok && editingModelId === m.id) resetModelForm();
  };

  const err = (key: string) =>
    fieldErrors[key]?.[0] ? <p className="text-destructive text-xs">{fieldErrors[key][0]}</p> : null;

  const TABS = [
    { key: "types" as const, label: "ประเภทลิฟต์", icon: Layers, count: types.length },
    { key: "models" as const, label: "รุ่นลิฟต์", icon: Tag, count: models.length },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">ข้อมูลลิฟต์</h1>
        <p className="text-muted-foreground">จัดการประเภทและรุ่นลิฟต์ที่ลูกค้าเลือกได้ในหน้ายื่นคำขอบริการ</p>
      </div>

      {/* แท็บ */}
      <div role="tablist" className="inline-flex rounded-lg border bg-muted p-1 gap-1">
        {TABS.map(({ key, label, icon: Icon, count }) => (
          <button
            key={key}
            role="tab"
            type="button"
            aria-selected={tab === key}
            onClick={() => switchTab(key)}
            className={cn(
              "flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors",
              tab === key ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4" />
            {label}
            <span className="rounded-full bg-muted-foreground/10 px-2 text-xs">{count}</span>
          </button>
        ))}
      </div>

      {message && (
        <div
          className={cn(
            "rounded-md border px-4 py-3 text-sm",
            message.type === "success"
              ? "border-green-300 bg-green-50 text-green-800"
              : "border-destructive/30 bg-destructive/10 text-destructive"
          )}
        >
          {message.text}
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : tab === "types" ? (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">ประเภทลิฟต์ในระบบ</CardTitle>
            </CardHeader>
            <CardContent>
              {types.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีประเภทลิฟต์ เพิ่มได้จากฟอร์มด้านข้าง</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">ชื่อประเภท</th>
                      <th className="py-2 pr-3 font-medium">รายละเอียด</th>
                      <th className="py-2 pr-3 font-medium text-center">จำนวนรุ่น</th>
                      <th className="py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {types.map((t) => (
                      <tr key={t.id} className={cn("border-b last:border-0", editingTypeId === t.id && "bg-primary/5")}>
                        <td className="py-2 pr-3 font-medium">{t.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{t.description || "-"}</td>
                        <td className="py-2 pr-3 text-center">{t._count.models}</td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => editType(t)} aria-label={`แก้ไข ${t.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteType(t)}
                            disabled={saving}
                            aria-label={`ลบ ${t.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">{editingTypeId ? "แก้ไขประเภทลิฟต์" : "เพิ่มประเภทลิฟต์"}</CardTitle>
              <CardDescription>เช่น ลิฟต์โดยสาร, ลิฟต์ขนของ, ลิฟต์โรงพยาบาล</CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitType} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="typeName">ชื่อประเภท <span className="text-destructive">*</span></Label>
                  <Input
                    id="typeName"
                    value={typeForm.name}
                    onChange={(e) => setTypeForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  {err("name")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="typeDesc">รายละเอียด</Label>
                  <Input
                    id="typeDesc"
                    value={typeForm.description}
                    onChange={(e) => setTypeForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  {err("description")}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={saving}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingTypeId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingTypeId ? "บันทึกการแก้ไข" : "เพิ่มประเภท"}
                  </Button>
                  {editingTypeId && (
                    <Button type="button" variant="outline" onClick={resetTypeForm}>
                      <X className="h-4 w-4" /> ยกเลิก
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-[1fr_360px]">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">รุ่นลิฟต์ในระบบ</CardTitle>
            </CardHeader>
            <CardContent>
              {models.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">ยังไม่มีรุ่นลิฟต์ เพิ่มได้จากฟอร์มด้านข้าง</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b text-left text-muted-foreground">
                      <th className="py-2 pr-3 font-medium">ยี่ห้อ</th>
                      <th className="py-2 pr-3 font-medium">รุ่น</th>
                      <th className="py-2 pr-3 font-medium">ประเภท</th>
                      <th className="py-2 pr-3 font-medium">รายละเอียด</th>
                      <th className="py-2 w-24" />
                    </tr>
                  </thead>
                  <tbody>
                    {models.map((m) => (
                      <tr key={m.id} className={cn("border-b last:border-0", editingModelId === m.id && "bg-primary/5")}>
                        <td className="py-2 pr-3 font-medium">{m.brand}</td>
                        <td className="py-2 pr-3">{m.name}</td>
                        <td className="py-2 pr-3">{m.type.name}</td>
                        <td className="py-2 pr-3 text-muted-foreground">{m.description || "-"}</td>
                        <td className="py-2 text-right whitespace-nowrap">
                          <Button size="icon" variant="ghost" onClick={() => editModel(m)} aria-label={`แก้ไข ${m.brand} ${m.name}`}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => deleteModel(m)}
                            disabled={saving}
                            aria-label={`ลบ ${m.brand} ${m.name}`}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </CardContent>
          </Card>

          <Card className="h-fit">
            <CardHeader>
              <CardTitle className="text-base">{editingModelId ? "แก้ไขรุ่นลิฟต์" : "เพิ่มรุ่นลิฟต์"}</CardTitle>
              <CardDescription>
                {types.length === 0 ? "ต้องเพิ่มประเภทลิฟต์ในแท็บ \"ประเภทลิฟต์\" ก่อน" : "รุ่นลิฟต์ต้องระบุประเภท"}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={submitModel} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="modelBrand">ยี่ห้อ <span className="text-destructive">*</span></Label>
                  <Input
                    id="modelBrand"
                    placeholder="เช่น OTIS, KONE"
                    value={modelForm.brand}
                    onChange={(e) => setModelForm((f) => ({ ...f, brand: e.target.value }))}
                  />
                  {err("brand")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelName">ชื่อรุ่น <span className="text-destructive">*</span></Label>
                  <Input
                    id="modelName"
                    placeholder="เช่น Gen2, MonoSpace 700"
                    value={modelForm.name}
                    onChange={(e) => setModelForm((f) => ({ ...f, name: e.target.value }))}
                  />
                  {err("name")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelType">ประเภทลิฟต์ <span className="text-destructive">*</span></Label>
                  <select
                    id="modelType"
                    className={selectClass}
                    value={modelForm.typeId}
                    onChange={(e) => setModelForm((f) => ({ ...f, typeId: e.target.value }))}
                  >
                    <option value="">— เลือกประเภท —</option>
                    {types.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </select>
                  {err("typeId")}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="modelDesc">รายละเอียด</Label>
                  <Input
                    id="modelDesc"
                    placeholder="เช่น น้ำหนักบรรทุก 1,000 กก."
                    value={modelForm.description}
                    onChange={(e) => setModelForm((f) => ({ ...f, description: e.target.value }))}
                  />
                  {err("description")}
                </div>
                <div className="flex gap-2">
                  <Button type="submit" className="flex-1" disabled={saving || types.length === 0}>
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : editingModelId ? <Pencil className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                    {editingModelId ? "บันทึกการแก้ไข" : "เพิ่มรุ่น"}
                  </Button>
                  {editingModelId && (
                    <Button type="button" variant="outline" onClick={resetModelForm}>
                      <X className="h-4 w-4" /> ยกเลิก
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
