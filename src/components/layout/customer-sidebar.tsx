// src/components/layout/customer-sidebar.tsx
"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, LayoutDashboard, FilePlus, FileText, CreditCard } from "lucide-react";
import { cn } from "@/lib/utils";

const NAV_ITEMS = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/jobs/new", label: "ยื่นคำขอบริการ", icon: FilePlus },
  { href: "/jobs", label: "ใบงานของฉัน", icon: FileText },
  { href: "/invoices", label: "ใบแจ้งหนี้", icon: CreditCard },
];

export function CustomerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 border-r bg-white flex flex-col shrink-0">
      <div className="h-14 flex items-center gap-2 px-5 border-b">
        <Building2 className="h-6 w-6 text-primary" />
        <span className="font-bold text-base leading-tight">Elevator<br />Service</span>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
          ลูกค้า
        </p>
      </div>

      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              "flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors",
              pathname === href || (href !== "/dashboard" && pathname.startsWith(href))
                ? "bg-primary text-primary-foreground font-medium"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            )}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {label}
          </Link>
        ))}
      </nav>
    </aside>
  );
}
