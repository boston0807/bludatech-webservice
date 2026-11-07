// src/app/admin/employees/page.tsx
// ธุรการจัดการบัญชีพนักงาน: เพิ่มพนักงาน แก้ชื่อ/ตำแหน่ง และตั้งรหัสผ่านใหม่
"use client";

import { useCallback, useEffect, useState } from "react";
import { KeyRound, Loader2, Pencil, UserPlus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROLE_LABEL, thDate } from "@/lib/labels";
import { Pagination, selectClass, useDebounced, usePagination } from "@/components/ui/list-controls";

type Employee = {
  id: string;
  username: string;
  employeeName: string;
  role: "ADMIN" | "ACCOUNTANT" | "TECHNICIAN" | "HEAD_TECHNICIAN";
  createdAt: string;
  _count: { surveys: number };
};

const ROLES = ["HEAD_TECHNICIAN", "TECHNICIAN", "ACCOUNTANT", "ADMIN"] as const;
const ROLE_VARIANT: Record<string, "default" | "secondary" | "warning" | "success"> = {
  ADMIN: "secondary",
  ACCOUNTANT: "success",
  TECHNICIAN: "warning",
  HEAD_TECHNICIAN: "default",
};

type Mode = { kind: "create" } | { kind: "edit"; emp: Employee } | { kind: "password"; emp: Employee } | null;

export default function EmployeesPage() {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [me, setMe] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [role, setRole] = useState("");
  const [mode, setMode] = useState<Mode>(null);
  const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
  const debouncedQ = useDebounced(q);
  const { pageItems, ...pager } = usePagination(employees, 15);

  const load = useCallback(() => {
    setLoading(true);
    const sp = new URLSearchParams();
    if (debouncedQ) sp.set("q", debouncedQ);
    if (role) sp.set("role", role);
    fetch(`/api/admin/employees?${sp}`)
      .then((r) => r.json())
      .then((d) => (d.success ? setEmployees(d.data) : setToast({ ok: false, text: d.message ?? "โหลดข้อมูลไม่สำเร็จ" })))
      .catch(() => setToast({ ok: false, text: "โหลดข้อมูลไม่สำเร็จ" }))
      .finally(() => setLoading(false));
  }, [debouncedQ, role]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((r) => r.json())
      .then((d) => d.success && setMe(d.data.sub))
      .catch(() => {});
  }, []);

  const done = (text: string) => {
    setMode(null);
    setToast({ ok: true, text });
    load();
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">จัดการพนักงาน</h1>
          <p className="text-muted-foreground">เพิ่มบัญชีพนักงาน กำหนดตำแหน่ง และตั้งรหัสผ่านใหม่ให้พนักงานที่ลืมรหัสผ่าน</p>
        </div>
        <Button onClick={() => setMode({ kind: "create" })}>
          <UserPlus className="h-4 w-4" /> เพิ่มพนักงาน
        </Button>
      </div>

      {toast && (
        <div
          className={`flex items-center justify-between rounded-md px-4 py-3 text-sm ${
            toast.ok ? "bg-green-50 text-green-700 border border-green-200" : "bg-destructive/10 text-destructive border border-destructive/30"
          }`}
        >
          {toast.text}
          <button type="button" onClick={() => setToast(null)} aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {mode && <EmployeeForm key={mode.kind === "create" ? "create" : `${mode.kind}-${mode.emp.id}`} mode={mode} isSelf={mode.kind !== "create" && mode.emp.id === me} onClose={() => setMode(null)} onDone={done} />}

      <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-white p-3">
        <div className="space-y-1 grow min-w-[200px]">
          <Label htmlFor="emp-q" className="text-xs">ค้นหา</Label>
          <Input id="emp-q" placeholder="ชื่อ หรือ username" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="space-y-1 w-48">
          <Label htmlFor="emp-role" className="text-xs">ตำแหน่ง</Label>
          <select id="emp-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value)}>
            <option value="">ทั้งหมด</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>{ROLE_LABEL[r]}</option>
            ))}
          </select>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : employees.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">ไม่พบพนักงาน</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-muted-foreground border-b">
                  <th className="py-2 pr-3 font-medium">ชื่อ</th>
                  <th className="py-2 pr-3 font-medium">Username</th>
                  <th className="py-2 pr-3 font-medium">ตำแหน่ง</th>
                  <th className="py-2 pr-3 font-medium text-right">งานที่ได้รับมอบหมาย</th>
                  <th className="py-2 pr-3 font-medium">เพิ่มเมื่อ</th>
                  <th className="py-2"></th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((e) => (
                  <tr key={e.id} className="border-b last:border-0">
                    <td className="py-2 pr-3 font-medium">
                      {e.employeeName} {e.id === me && <span className="text-xs text-muted-foreground">(คุณ)</span>}
                    </td>
                    <td className="py-2 pr-3 font-mono text-xs">{e.username}</td>
                    <td className="py-2 pr-3">
                      <Badge variant={ROLE_VARIANT[e.role]}>{ROLE_LABEL[e.role] ?? e.role}</Badge>
                    </td>
                    <td className="py-2 pr-3 text-right tabular-nums">
                      {e._count.surveys} สำรวจ
                    </td>
                    <td className="py-2 pr-3">{thDate(e.createdAt)}</td>
                    <td className="py-2 text-right whitespace-nowrap">
                      <Button size="sm" variant="ghost" onClick={() => setMode({ kind: "edit", emp: e })}>
                        <Pencil className="h-4 w-4" /> แก้ไข
                      </Button>
                      <Button size="sm" variant="ghost" onClick={() => setMode({ kind: "password", emp: e })}>
                        <KeyRound className="h-4 w-4" /> รหัสผ่าน
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="pt-4">
            <Pagination {...pager} onPage={pager.setPage} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function EmployeeForm({
  mode,
  isSelf,
  onClose,
  onDone,
}: {
  mode: NonNullable<Mode>;
  isSelf: boolean;
  onClose: () => void;
  onDone: (msg: string) => void;
}) {
  const emp = mode.kind === "create" ? null : mode.emp;
  const [username, setUsername] = useState("");
  const [employeeName, setEmployeeName] = useState(emp?.employeeName ?? "");
  const [role, setRole] = useState<string>(emp?.role ?? "TECHNICIAN");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if ((mode.kind === "create" || mode.kind === "password") && password.length < 8) {
      setError("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
      return;
    }
    setSaving(true);
    try {
      const res =
        mode.kind === "create"
          ? await fetch("/api/admin/employees", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ username, employeeName, role, password }),
            })
          : await fetch(`/api/admin/employees/${emp!.id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(mode.kind === "password" ? { newPassword: password } : { employeeName, role }),
            });
      const d = await res.json();
      if (!res.ok) {
        setError(d.message ?? "บันทึกไม่สำเร็จ");
        return;
      }
      onDone(d.message ?? "บันทึกสำเร็จ");
    } catch {
      setError("เกิดข้อผิดพลาด กรุณาลองใหม่");
    } finally {
      setSaving(false);
    }
  };

  const title =
    mode.kind === "create" ? "เพิ่มพนักงานใหม่" : mode.kind === "edit" ? `แก้ไขข้อมูล: ${emp!.employeeName}` : `ตั้งรหัสผ่านใหม่: ${emp!.employeeName}`;

  return (
    <Card className="border-primary">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <button type="button" onClick={onClose} aria-label="ปิด">
            <X className="h-4 w-4" />
          </button>
        </div>
        {mode.kind === "password" && (
          <CardDescription>แจ้งรหัสผ่านใหม่ให้พนักงานทราบ และให้เปลี่ยนเองที่หน้า &quot;เปลี่ยนรหัสผ่าน&quot; หลังเข้าสู่ระบบ</CardDescription>
        )}
        {mode.kind === "edit" && (
          <CardDescription>การเปลี่ยนตำแหน่งจะมีผลเมื่อพนักงานเข้าสู่ระบบครั้งถัดไป</CardDescription>
        )}
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} className="grid gap-4 sm:grid-cols-2">
          {error && <div className="sm:col-span-2 rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-sm text-destructive">{error}</div>}
          {mode.kind === "create" && (
            <div className="space-y-1.5">
              <Label htmlFor="f-username">Username</Label>
              <Input id="f-username" value={username} onChange={(e) => setUsername(e.target.value)} required minLength={4} maxLength={50} pattern="[a-zA-Z0-9_]+" autoComplete="off" />
            </div>
          )}
          {mode.kind !== "password" && (
            <>
              <div className="space-y-1.5">
                <Label htmlFor="f-name">ชื่อพนักงาน</Label>
                <Input id="f-name" value={employeeName} onChange={(e) => setEmployeeName(e.target.value)} required maxLength={100} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="f-role">ตำแหน่ง</Label>
                <select id="f-role" className={selectClass} value={role} onChange={(e) => setRole(e.target.value)} disabled={isSelf}>
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{ROLE_LABEL[r]}</option>
                  ))}
                </select>
                {isSelf && <p className="text-xs text-muted-foreground">ไม่สามารถเปลี่ยนตำแหน่งของตัวเองได้</p>}
              </div>
            </>
          )}
          {(mode.kind === "create" || mode.kind === "password") && (
            <div className="space-y-1.5">
              <Label htmlFor="f-pass">{mode.kind === "create" ? "รหัสผ่านเริ่มต้น" : "รหัสผ่านใหม่"}</Label>
              <Input id="f-pass" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete="new-password" />
            </div>
          )}
          <div className="sm:col-span-2 flex gap-2">
            <Button type="submit" disabled={saving}>
              {saving && <Loader2 className="h-4 w-4 animate-spin" />} บันทึก
            </Button>
            <Button type="button" variant="ghost" onClick={onClose}>ยกเลิก</Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
