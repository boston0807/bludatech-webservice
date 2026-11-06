// src/lib/job-timeline.ts
// ประกอบ timeline ความคืบหน้าของใบงานจากวันที่ที่มีอยู่แล้วในแต่ละตาราง (ไม่ต้องมีตารางเก็บประวัติสถานะ)

export type TimelineJob = {
  status: string;
  requestDate: string;
  reworkNote?: string | null;
  surveys?: { surveyDate: string; method?: string; technician?: { employeeName: string } | null }[];
  quotation?: { status: string; createdAt: string; updatedAt?: string; rejectNote?: string | null; totalAmount?: string } | null;
  workPlan?: {
    status: string;
    startDate: string;
    endDate: string;
    createdAt?: string;
    updatedAt?: string;
    rejectNote?: string | null;
  } | null;
  safetyChecks?: { passed: boolean; checkedAt: string }[];
  receipt?: {
    status: string;
    createdAt?: string;
    updatedAt?: string;
    payments?: { paymentDate: string; amount: string | number }[];
  } | null;
};

export type StepState = "done" | "current" | "pending";

export type Step = { key: string; label: string; date: string | null; state: StepState; hint?: string };

export type TimelineEvent = {
  date: string;
  /** ไม่มีเวลาที่บันทึกจริง (แสดงว่า "ล่าสุด" แทนวันที่) */
  undated?: boolean;
  endDate?: string;
  title: string;
  detail?: string;
  tone: "default" | "success" | "warning" | "danger" | "scheduled";
};

export const STEP_DEFS = [
  { key: "PENDING", label: "ยื่นคำขอ" },
  { key: "PASS_SURVEY", label: "สำรวจหน้างาน" },
  { key: "QUOTED", label: "ใบเสนอราคา" },
  { key: "APPROVE", label: "อนุมัติราคา" },
  { key: "PLAN_APPROVED", label: "อนุมัติแผน" },
  { key: "IN_PROGRESS", label: "ปฏิบัติงาน" },
  { key: "WAITING_ACCEPTANCE", label: "รอตรวจรับ" },
  { key: "ACCEPTED", label: "ตรวจรับแล้ว" },
  { key: "PAID", label: "ชำระเงิน" },
  { key: "COMPLETED", label: "ปิดงาน" },
] as const;

const ORDER: string[] = STEP_DEFS.map((s) => s.key);

// สถานะที่ไม่อยู่ในเส้นทางหลัก → นับว่าอยู่ขั้นไหน
const STATUS_TO_STEP: Record<string, string> = { REQUEST_EDIT: "QUOTED" };

// คำอธิบายสั้น ๆ ว่าตอนนี้รออะไร / ใครต้องทำอะไรต่อ
const NEXT_ACTION: Record<string, string> = {
  PENDING: "รอช่างนัดสำรวจหน้างาน",
  PASS_SURVEY: "ฝ่ายบัญชีกำลังจัดทำใบเสนอราคา",
  QUOTED: "รอคุณพิจารณาใบเสนอราคา",
  REQUEST_EDIT: "ฝ่ายบัญชีกำลังปรับใบเสนอราคาตามที่คุณขอ",
  APPROVE: "หัวหน้าช่างกำลังจัดทำแผนงาน / รอคุณอนุมัติแผน",
  PLAN_APPROVED: "รอถึงวันเข้าปฏิบัติงาน",
  IN_PROGRESS: "ช่างกำลังปฏิบัติงาน",
  WAITING_ACCEPTANCE: "รอคุณตรวจรับงาน",
  ACCEPTED: "ฝ่ายบัญชีกำลังออกใบแจ้งหนี้",
  PAID: "รอธุรการบันทึกประวัติและปิดงาน",
  COMPLETED: "งานเสร็จสมบูรณ์",
};

export function nextActionText(status: string): string | null {
  return NEXT_ACTION[status] ?? null;
}

const PLAN_APPROVED_STATES = ["APPROVED", "IN_PROGRESS", "FINISHED"];
const WORK_STARTED_STATUSES = ["IN_PROGRESS", "WAITING_ACCEPTANCE", "ACCEPTED", "PAID", "COMPLETED"];

const byDate = <T extends { [k: string]: unknown }>(arr: T[] | undefined, key: keyof T) =>
  [...(arr ?? [])].sort((a, b) => Date.parse(String(a[key])) - Date.parse(String(b[key])));

export function buildSteps(job: TimelineJob): Step[] {
  const currentKey = STATUS_TO_STEP[job.status] ?? job.status;
  const currentIdx = ORDER.indexOf(currentKey);
  const surveys = byDate(job.surveys, "surveyDate");
  const checks = byDate(job.safetyChecks, "checkedAt");
  const payments = byDate(job.receipt?.payments, "paymentDate");
  const q = job.quotation;
  const plan = job.workPlan;

  const dates: Record<string, string | null> = {
    PENDING: job.requestDate,
    PASS_SURVEY: surveys[0]?.surveyDate ?? null,
    QUOTED: q?.createdAt ?? null,
    APPROVE: q?.status === "APPROVED" ? q.updatedAt ?? null : null,
    PLAN_APPROVED: plan && PLAN_APPROVED_STATES.includes(plan.status) ? plan.updatedAt ?? null : null,
    IN_PROGRESS: plan && WORK_STARTED_STATUSES.includes(job.status) ? plan.startDate : null,
    WAITING_ACCEPTANCE: [...checks].reverse().find((c) => c.passed)?.checkedAt ?? null,
    ACCEPTED: job.receipt?.createdAt ?? null,
    PAID: payments[0]?.paymentDate ?? null,
    COMPLETED: null,
  };

  return STEP_DEFS.map((def, idx) => {
    const state: StepState =
      job.status === "COMPLETED" || idx < currentIdx ? "done" : idx === currentIdx ? "current" : "pending";
    let date = state === "pending" ? null : dates[def.key];
    let hint: string | undefined;
    // ขั้นที่ยังไม่ถึงแต่มีกำหนดการแล้ว (เช่น วันเริ่มงานตามแผน)
    if (def.key === "IN_PROGRESS" && state !== "done" && plan && PLAN_APPROVED_STATES.includes(plan.status)) {
      date = plan.startDate;
      hint = "กำหนดการ";
    }
    return { key: def.key, label: def.label, date, state, hint };
  });
}

export function buildEvents(job: TimelineJob): TimelineEvent[] {
  const events: TimelineEvent[] = [{ date: job.requestDate, title: "ยื่นคำขอบริการ", tone: "default" }];

  for (const s of job.surveys ?? []) {
    events.push({
      date: s.surveyDate,
      title: s.method === "REMOTE" ? "ประเมินงานแบบออนไลน์" : "ช่างสำรวจหน้างาน",
      detail: s.technician?.employeeName ? `โดย ${s.technician.employeeName}` : undefined,
      tone: "default",
    });
  }

  const q = job.quotation;
  if (q) {
    events.push({ date: q.createdAt, title: "ออกใบเสนอราคา", tone: "default" });
    if (q.updatedAt && q.status === "APPROVED") {
      events.push({ date: q.updatedAt, title: "อนุมัติใบเสนอราคา", tone: "success" });
    } else if (q.updatedAt && q.status === "REJECTED") {
      events.push({ date: q.updatedAt, title: "ขอแก้ไขใบเสนอราคา", detail: q.rejectNote ?? undefined, tone: "warning" });
    }
  }

  const plan = job.workPlan;
  if (plan) {
    if (plan.createdAt) events.push({ date: plan.createdAt, title: "จัดทำแผนงานและมอบหมายช่าง", tone: "default" });
    if (plan.updatedAt && PLAN_APPROVED_STATES.includes(plan.status)) {
      events.push({ date: plan.updatedAt, title: "อนุมัติแผนงาน", tone: "success" });
    } else if (plan.updatedAt && plan.status === "REJECTED") {
      events.push({ date: plan.updatedAt, title: "ขอให้ปรับแผนงาน", detail: plan.rejectNote ?? undefined, tone: "warning" });
    }
    if (job.status !== "CANCELLED") {
      const started = WORK_STARTED_STATUSES.includes(job.status);
      events.push({
        date: plan.startDate,
        title: started ? "เริ่มปฏิบัติงาน" : "กำหนดเข้าปฏิบัติงาน",
        endDate: plan.endDate,
        tone: started ? "default" : "scheduled",
      });
    }
  }

  for (const c of job.safetyChecks ?? []) {
    events.push({
      date: c.checkedAt,
      title: c.passed ? "ผ่านการทดสอบความปลอดภัย" : "ทดสอบความปลอดภัยไม่ผ่าน (กำลังแก้ไข)",
      tone: c.passed ? "success" : "danger",
    });
  }

  if (job.reworkNote && job.status === "IN_PROGRESS") {
    events.push({
      date: new Date().toISOString(), // ใช้เพื่อเรียงไว้ท้ายสุดเท่านั้น
      undated: true,
      title: "ส่งงานกลับให้ช่างแก้ไข",
      detail: job.reworkNote,
      tone: "warning",
    });
  }

  if (job.receipt?.createdAt) {
    events.push({ date: job.receipt.createdAt, title: "ตรวจรับงาน / ออกใบแจ้งหนี้", tone: "default" });
  }
  for (const p of job.receipt?.payments ?? []) {
    events.push({ date: p.paymentDate, title: "ชำระเงิน", tone: "success" });
  }

  if (job.status === "CANCELLED") {
    events.push({ date: q?.updatedAt ?? new Date().toISOString(), title: "ยกเลิกใบงาน", tone: "danger" });
  }

  return events.sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
}
