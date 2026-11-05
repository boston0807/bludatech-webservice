// src/lib/upload-client.ts
// ฝั่ง browser: ย่อรูปก่อนอัปโหลด (รูปจากมือถือ 4–8 MB → ~300 KB) แล้วส่งไป /api/jobs/:id/attachments

export type AttachmentCategory = "PAYMENT_SLIP" | "SURVEY" | "SAFETY_CHECK" | "WORK_BEFORE" | "WORK_AFTER";

export type AttachmentInfo = {
  id: string;
  category: AttachmentCategory;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
  caption?: string | null;
  createdAt: string;
  surveyId?: string | null;
  safetyCheckId?: string | null;
  paymentId?: string | null;
  uploadedByEmployee?: { employeeName: string } | null;
  uploadedByCustomer?: { customerName: string } | null;
};

export const ATTACHMENT_LABEL: Record<AttachmentCategory, string> = {
  PAYMENT_SLIP: "สลิปการชำระเงิน",
  SURVEY: "รูปสำรวจหน้างาน",
  SAFETY_CHECK: "รูปทดสอบความปลอดภัย",
  WORK_BEFORE: "รูปก่อนเริ่มงาน",
  WORK_AFTER: "รูปหลังทำงานเสร็จ",
};

export const attachmentUrl = (id: string) => `/api/attachments/${id}`;

const MAX_DIMENSION = 1600;
const JPEG_QUALITY = 0.82;
const SKIP_BELOW_BYTES = 400 * 1024;

/** ย่อรูปให้ด้านยาวไม่เกิน 1600px และแปลงเป็น JPEG — ถ้าเปิดรูปไม่ได้ (เช่น HEIC บน Chrome) ส่งไฟล์เดิม */
export async function compressImage(file: File): Promise<File> {
  if (!file.type.startsWith("image/") || file.size < SKIP_BELOW_BYTES) return file;
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_DIMENSION / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY));
    if (!blob || blob.size >= file.size) return file;
    return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" });
  } catch {
    return file;
  }
}

export async function uploadAttachment(
  jobId: string,
  category: AttachmentCategory,
  file: File,
  caption?: string
): Promise<AttachmentInfo> {
  const form = new FormData();
  form.append("category", category);
  form.append("file", await compressImage(file));
  if (caption) form.append("caption", caption);

  const res = await fetch(`/api/jobs/${jobId}/attachments`, { method: "POST", body: form });
  const data = await res.json().catch(() => null);
  if (!data?.success) throw new Error(data?.message ?? "อัปโหลดไฟล์ไม่สำเร็จ");
  return data.data as AttachmentInfo;
}

export async function deleteAttachment(id: string): Promise<void> {
  const res = await fetch(attachmentUrl(id), { method: "DELETE" });
  const data = await res.json().catch(() => null);
  if (!data?.success) throw new Error(data?.message ?? "ลบไฟล์ไม่สำเร็จ");
}
