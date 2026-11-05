// src/lib/storage.ts
// Supabase Storage (ฝั่ง server เท่านั้น) — ระบบใช้ JWT ของตัวเอง ไม่ได้ใช้ Supabase Auth
// จึงอัปโหลด/ออก signed URL ผ่าน service role key และตรวจสิทธิ์เองใน API route
//
// Env: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (secret — ห้ามใส่ใน vars ของ wrangler / ห้ามขึ้นต้นด้วย NEXT_PUBLIC_)
// Bucket: job-files (private) — สร้างด้วย prisma/sql/2026-11-05_attachments-notifications.sql

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

export const STORAGE_BUCKET = "job-files";
const SIGNED_URL_TTL_SECONDS = 60 * 5;

function getClient(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    throw new Error("Supabase Storage ยังไม่ได้ตั้งค่า (ต้องมี NEXT_PUBLIC_SUPABASE_URL และ SUPABASE_SERVICE_ROLE_KEY)");
  }
  // สร้างใหม่ทุกครั้ง: client เป็นแค่ตัวห่อ fetch และบน Workers ห้ามใช้ I/O object ข้าม request
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export async function uploadObject(path: string, body: ArrayBuffer, contentType: string): Promise<void> {
  const { error } = await getClient().storage.from(STORAGE_BUCKET).upload(path, body, { contentType, upsert: false });
  if (error) throw new Error(`อัปโหลดไฟล์ไม่สำเร็จ: ${error.message}`);
}

export async function removeObject(path: string): Promise<void> {
  const { error } = await getClient().storage.from(STORAGE_BUCKET).remove([path]);
  if (error) console.error("[STORAGE_REMOVE_ERROR]", path, error.message);
}

export async function createSignedUrl(path: string): Promise<string> {
  const { data, error } = await getClient().storage.from(STORAGE_BUCKET).createSignedUrl(path, SIGNED_URL_TTL_SECONDS);
  if (error || !data) throw new Error(`สร้างลิงก์ไฟล์ไม่สำเร็จ: ${error?.message}`);
  return data.signedUrl;
}
