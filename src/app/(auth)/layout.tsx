// src/app/(auth)/layout.tsx
// layout สำหรับ auth pages — ไม่มี sidebar/navbar
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
