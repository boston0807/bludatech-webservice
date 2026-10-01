// src/app/not-found.tsx
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-4 text-center p-4">
      <h1 className="text-6xl font-bold text-muted-foreground">404</h1>
      <p className="text-xl font-medium">ไม่พบหน้าที่ต้องการ</p>
      <p className="text-muted-foreground">หน้านี้ไม่มีอยู่หรือถูกย้ายไปแล้ว</p>
      <Link href="/">
        <Button variant="outline">กลับหน้าหลัก</Button>
      </Link>
    </div>
  );
}
