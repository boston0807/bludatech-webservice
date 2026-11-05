// src/lib/labels.ts
// ป้ายภาษาไทยที่ใช้ร่วมกันหลายหน้า

export const JOB_TYPE_LABEL: Record<string, string> = {
  INSTALLATION: "ติดตั้งลิฟต์",
  REPAIR: "ซ่อมรายครั้ง",
  SERVICE: "บำรุงรักษา",
};

export const JOB_STATUS_LABEL: Record<string, string> = {
  PENDING: "รอสำรวจ",
  PASS_SURVEY: "สำรวจแล้ว",
  QUOTED: "มีใบเสนอราคา",
  REQUEST_EDIT: "ขอแก้ไขใบเสนอราคา",
  APPROVE: "อนุมัติใบเสนอราคาแล้ว",
  PLAN_APPROVED: "แผนงานอนุมัติแล้ว",
  IN_PROGRESS: "กำลังปฏิบัติงาน",
  WAITING_ACCEPTANCE: "รอตรวจรับงาน",
  ACCEPTED: "ตรวจรับแล้ว",
  PAID: "ชำระเงินแล้ว",
  COMPLETED: "เสร็จสิ้น",
  CANCELLED: "ยกเลิก",
};

export const PLAN_STATUS_LABEL: Record<string, string> = {
  DRAFT: "รอลูกค้าอนุมัติแผน",
  REJECTED: "ลูกค้าขอให้ปรับแผน",
  APPROVED: "ลูกค้าอนุมัติแผนแล้ว",
  IN_PROGRESS: "กำลังปฏิบัติงานตามแผน",
  FINISHED: "เสร็จสิ้นตามแผน",
};

export const PLAN_STATUS_VARIANT: Record<string, "default" | "secondary" | "warning" | "success" | "destructive" | "outline"> = {
  DRAFT: "warning",
  REJECTED: "destructive",
  APPROVED: "success",
  IN_PROGRESS: "default",
  FINISHED: "success",
};

export const RECEIPT_STATUS_LABEL: Record<string, string> = {
  DRAFT: "รอบัญชีตรวจสอบ",
  UNPAID: "รอชำระเงิน",
  PAID: "ชำระเงินแล้ว",
  CANCELLED: "ยกเลิก",
};

export const ROLE_LABEL: Record<string, string> = {
  TECHNICIAN: "ช่าง",
  HEAD_TECHNICIAN: "หัวหน้าช่าง",
  ADMIN: "ธุรการ",
  ACCOUNTANT: "บัญชี",
};

export function thDate(d: string | Date | null | undefined): string {
  if (!d) return "-";
  return new Date(d).toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric", timeZone: "Asia/Bangkok" });
}

export function thDateRange(start: string | Date, end: string | Date | null | undefined): string {
  const a = thDate(start);
  const b = end ? thDate(end) : a;
  return a === b ? a : `${a} – ${b}`;
}

export function baht(n: number | string | null | undefined): string {
  return `${Number(n ?? 0).toLocaleString("th-TH", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} บาท`;
}

/** แปลง Date/ISO เป็นค่า yyyy-mm-dd ตามเวลาไทย สำหรับ <input type="date"> */
export function toDateInput(d: string | Date | null | undefined): string {
  const date = d ? new Date(d) : new Date();
  return new Date(date.getTime() + 7 * 3600 * 1000).toISOString().slice(0, 10);
}

/** ค่า yyyy-mm-dd จาก <input type="date"> → ISO เวลา 09:00 น. (เวลาไทย) ของวันนั้น */
export function dateInputToIso(v: string): string {
  return new Date(`${v}T09:00:00+07:00`).toISOString();
}
