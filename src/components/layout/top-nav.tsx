// src/components/layout/top-nav.tsx
"use client";

import { useRouter } from "next/navigation";
import { LogOut, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

type Role = "CUSTOMER" | "ADMIN" | "ACCOUNTANT" | "TECHNICIAN" | "HEAD_TECHNICIAN";

const ROLE_LABEL: Record<Role, string> = {
  CUSTOMER: "ลูกค้า",
  ADMIN: "ธุรการ",
  ACCOUNTANT: "บัญชี",
  TECHNICIAN: "ช่าง",
  HEAD_TECHNICIAN: "หัวหน้าช่าง",
};

const ROLE_VARIANT: Record<Role, "default" | "secondary" | "warning" | "success" | "outline"> = {
  CUSTOMER: "default",
  ADMIN: "secondary",
  ACCOUNTANT: "success",
  TECHNICIAN: "warning",
  HEAD_TECHNICIAN: "warning",
};

type Props = {
  user: { name: string; role: string };
};

export function TopNav({ user }: Props) {
  const router = useRouter();

  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    window.location.href = "/login";
  };

  const role = user.role as Role;

  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6 shrink-0">
      <div />
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-2 text-sm">
          <User className="h-4 w-4 text-muted-foreground" />
          <span className="font-medium">{user.name}</span>
          <Badge variant={ROLE_VARIANT[role] ?? "outline"} className="text-xs">
            {ROLE_LABEL[role] ?? role}
          </Badge>
        </div>
        <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground">
          <LogOut className="h-4 w-4" />
          ออกจากระบบ
        </Button>
      </div>
    </header>
  );
}
