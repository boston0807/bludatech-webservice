// src/app/admin/layout.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { AdminSidebar } from "@/components/layout/admin-sidebar";
import { TopNav } from "@/components/layout/top-nav";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== "ADMIN") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav user={{ name: session.name, role: session.role }} />
        <main className="flex-1 p-6 bg-gray-50/50">{children}</main>
      </div>
    </div>
  );
}
