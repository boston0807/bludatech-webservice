// src/app/page.tsx
import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";

export default async function Home() {
  const session = await getSession();

  if (!session) {
    redirect("/login");
  }

  const dashboardMap: Record<string, string> = {
    CUSTOMER: "/dashboard",
    ADMIN: "/admin/dashboard",
    ACCOUNTANT: "/accountant/dashboard",
    TECHNICIAN: "/technician/dashboard",
    HEAD_TECHNICIAN: "/technician/dashboard",
  };

  redirect(dashboardMap[session.role] ?? "/login");
}
