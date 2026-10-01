// src/app/admin/customers/pending/page.tsx
"use client";

import { useEffect, useState, useCallback } from "react";
import { CheckCircle2, XCircle, Clock, User, Phone, Mail, MapPin, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

type Customer = {
  id: string;
  username: string;
  customerName: string;
  customerPhone: string;
  customerEmail: string | null;
  taxId: string | null;
  customerAddress: string;
  status: "PENDING" | "ACTIVE" | "REJECTED";
  createdAt: string;
};

export default function PendingCustomersPage() {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const showToast = (message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const fetchCustomers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/customers?status=PENDING");
      const data = await res.json();
      if (res.ok && data.success) {
        setCustomers(data.data);
      } else {
        showToast(data.message ?? "โหลดข้อมูลไม่สำเร็จ", "error");
      }
    } catch (err) {
      console.error(err);
      showToast("ไม่สามารถเชื่อมต่อ server ได้", "error");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCustomers();
  }, [fetchCustomers]);

  const handleAction = async (customerId: string, action: "APPROVE" | "REJECT") => {
    setActionLoading(customerId + action);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action }),
      });

      const data = await res.json();

      if (res.ok) {
        showToast(data.data.message, "success");
        setCustomers((prev) => prev.filter((c) => c.id !== customerId));
      } else {
        showToast(data.message ?? "เกิดข้อผิดพลาด", "error");
      }
    } catch {
      showToast("เกิดข้อผิดพลาด กรุณาลองใหม่", "error");
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Toast Notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg text-white text-sm font-medium transition-all ${
            toast.type === "success" ? "bg-green-600" : "bg-destructive"
          }`}
        >
          {toast.message}
        </div>
      )}

      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">อนุมัติลูกค้าใหม่</h1>
          <p className="text-muted-foreground">ตรวจสอบและอนุมัติการสมัครสมาชิกของลูกค้า</p>
        </div>
        <Badge variant="warning" className="text-sm px-3 py-1">
          <Clock className="h-3.5 w-3.5 mr-1" />
          รออนุมัติ {customers.length} ราย
        </Badge>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="flex justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      )}

      {/* Empty State */}
      {!loading && customers.length === 0 && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-20 text-center">
            <CheckCircle2 className="h-12 w-12 text-green-500 mb-3" />
            <p className="text-lg font-medium">ไม่มีคำขอรออนุมัติ</p>
            <p className="text-muted-foreground text-sm">ลูกค้าทุกรายได้รับการดำเนินการแล้ว</p>
          </CardContent>
        </Card>
      )}

      {/* Customer Cards */}
      {!loading && customers.length > 0 && (
        <div className="grid gap-4">
          {customers.map((customer) => (
            <Card key={customer.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-primary/10 rounded-full p-2">
                      <User className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{customer.customerName}</CardTitle>
                      <CardDescription>@{customer.username}</CardDescription>
                    </div>
                  </div>
                  <Badge variant="warning">
                    <Clock className="h-3 w-3 mr-1" />
                    รออนุมัติ
                  </Badge>
                </div>
              </CardHeader>

              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                  <div className="flex items-center gap-2 text-muted-foreground">
                    <Phone className="h-4 w-4 flex-shrink-0" />
                    <span>{customer.customerPhone}</span>
                  </div>
                  {customer.customerEmail && (
                    <div className="flex items-center gap-2 text-muted-foreground">
                      <Mail className="h-4 w-4 flex-shrink-0" />
                      <span>{customer.customerEmail}</span>
                    </div>
                  )}
                  <div className="flex items-start gap-2 text-muted-foreground md:col-span-2">
                    <MapPin className="h-4 w-4 flex-shrink-0 mt-0.5" />
                    <span>{customer.customerAddress}</span>
                  </div>
                  {customer.taxId && (
                    <div className="text-muted-foreground">
                      <span className="font-medium text-foreground">เลขผู้เสียภาษี:</span>{" "}
                      {customer.taxId}
                    </div>
                  )}
                  <div className="text-muted-foreground">
                    <span className="font-medium text-foreground">วันที่สมัคร:</span>{" "}
                    {new Date(customer.createdAt).toLocaleDateString("th-TH", {
                      year: "numeric",
                      month: "long",
                      day: "numeric",
                    })}
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2 pt-1">
                  <Button
                    onClick={() => handleAction(customer.id, "APPROVE")}
                    disabled={actionLoading !== null}
                    className="flex-1 bg-green-600 hover:bg-green-700 text-white"
                  >
                    {actionLoading === customer.id + "APPROVE" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4" />
                    )}
                    อนุมัติ
                  </Button>
                  <Button
                    onClick={() => handleAction(customer.id, "REJECT")}
                    disabled={actionLoading !== null}
                    variant="destructive"
                    className="flex-1"
                  >
                    {actionLoading === customer.id + "REJECT" ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <XCircle className="h-4 w-4" />
                    )}
                    ปฏิเสธ
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
