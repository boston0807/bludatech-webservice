// src/app/(customer)/layout.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { CustomerSidebar } from "@/components/layout/customer-sidebar";
import { TopNav } from "@/components/layout/top-nav";

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();

  if (!session || session.role !== "CUSTOMER") {
    redirect("/login");
  }

  return (
    <div className="min-h-screen flex">
      <CustomerSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <TopNav user={{ name: session.name, role: session.role }} />
        <main className="flex-1 p-6 bg-gray-50/50">{children}</main>
      </div>
    </div>
  );
}
