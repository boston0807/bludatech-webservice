# UseCase → Business Component Mapping

> อัปเดตล่าสุด: 7 ตุลาคม 2026

---

## UC01 — เข้าสู่ระบบ (Login)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Customer, Employee (ทุก role) |
| **Page** | `(auth)/login/page.tsx` |
| **Form Component** | `(auth)/login/login-form.tsx` |
| **API** | `POST /api/auth/login` |
| **Method** | `signToken()`, `verifyToken()` — `src/lib/auth.ts` |
| **Middleware** | `src/middleware.ts` — redirect ตาม role หลัง login |

---

## UC02 — สมัครสมาชิก (Register)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Customer |
| **Page** | `(auth)/register/page.tsx` |
| **API** | `POST /api/auth/register` |
| **Validation** | `src/lib/validations/auth.ts` |

---

## UC03 — อนุมัติ/ปฏิเสธลูกค้า (Admin)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Admin |
| **Page** | `admin/customers/pending/page.tsx` |
| **API** | `GET /api/admin/customers` |
| **API** | `PATCH /api/admin/customers/:id/approve` |
| **Notification** | `sendCustomerApprovalEmail()` — `src/lib/email.ts` |

---

## UC04 — ยื่นคำขอบริการ (Customer)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Customer |
| **Pages** | `(customer)/jobs/new/page.tsx` — ฟอร์มยื่นคำขอ |
| | `(customer)/jobs/page.tsx` — รายการใบงาน |
| | `(customer)/jobs/[id]/page.tsx` — รายละเอียดใบงาน |
| **API** | `POST /api/jobs` — สร้างใบงาน |
| **API** | `GET /api/jobs` — รายการใบงาน |
| **API** | `GET /api/jobs/:id` — รายละเอียด |
| **Validation** | `src/lib/validations/job.ts` |

---

## UC05 — สำรวจหน้างาน (Head Technician)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Head Technician |
| **Pages** | `technician/jobs/page.tsx` — รายการงาน |
| | `technician/jobs/[id]/survey/page.tsx` — ฟอร์มสำรวจ |
| **API** | `POST /api/jobs/:id/survey` — บันทึกผลสำรวจ → status: `PASS_SURVEY` |
| **API** | `POST /api/jobs/:id/expenses` — เพิ่มรายการค่าใช้จ่าย |
| **API** | `PATCH /api/jobs/:id/expenses/:expenseId` — แก้ไข |
| **API** | `DELETE /api/jobs/:id/expenses/:expenseId` — ลบ |
| **Validation** | `src/lib/validations/survey.ts` |

---

## UC06 — จัดทำใบเสนอราคา (Accountant)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Accountant |
| **Pages** | `accountant/quotations/page.tsx` — รายการงานรอออกใบเสนอราคา |
| | `accountant/quotations/[id]/page.tsx` — ฟอร์มสร้างใบเสนอราคา |
| **API** | `POST /api/jobs/:id/quotation` — สร้างใบเสนอราคา → status: `QUOTED` |
| **API** | `GET /api/jobs/:id/quotation` — ดูใบเสนอราคา |
| **Validation** | `src/lib/validations/quotation.ts` |
| **Notification** | `sendQuotationCreatedEmail()` — `src/lib/email.ts` |

---

## UC07 — ลูกค้าอนุมัติ/ปฏิเสธใบเสนอราคา (Customer)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Customer |
| **Page** | `(customer)/jobs/[id]/page.tsx` — inline ในหน้า job detail |
| **API** | `PATCH /api/quotations/:id` — action: `APPROVE` / `REJECT` / `CANCEL` |

---

## UC08 — ทำแผนงานและจองอุปกรณ์ (Head Technician)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Head Technician |
| **Page** | `technician/workplans/page.tsx` |
| **API** | `POST /api/jobs/:id/workplan` — สร้างแผนงาน |
| **API** | `POST /api/workplans/:id/materials` — จองวัสดุ |
| **Validation** | `src/lib/validations/workplan.ts` |

---

## UC09 — อนุมัติแผนงาน (Admin)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Admin |
| **Page** | `admin/workplans/pending/page.tsx` |
| **API** | `PATCH /api/workplans/:id/approve` — อนุมัติแผน → status: `APPROVED` |

---

## UC10 — ตรวจสอบสต็อกอุปกรณ์ (Technician)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Technician |
| **Page** | `technician/materials/page.tsx` |
| **API** | `GET /api/workplans/:id/materials/check` — เช็กยอดสต็อก vs ที่จอง |

---

## UC11 — สั่งซื้ออุปกรณ์เพิ่ม (Accountant)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Accountant |
| **Page** | `accountant/purchase/page.tsx` |
| **API** | `GET /api/materials` — รายการวัสดุ |
| **API** | `POST /api/materials` — เพิ่มวัสดุใหม่ |
| **API** | `PATCH /api/materials/:id/stock` — อัปเดตยอดสต็อก |

---

## UC12 — ปฏิบัติงาน (Technician)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Technician |
| **Page** | `technician/workplans/page.tsx` |
| **API** | `PATCH /api/jobs/:id/start` — เริ่มงาน → status: `IN_PROGRESS` |
| **API** | `PATCH /api/jobs/:id/complete` — เสร็จงาน |

---

## UC13 — ทดสอบความปลอดภัย (Technician)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Technician / Head Technician |
| **Page** | `technician/workplans/page.tsx` — Safety Checklist inline |
| **API** | `POST /api/jobs/:id/safety-check` — บันทึกผล → ถ้าผ่าน status: `WAITING_ACCEPTANCE` |
| **Notification** | `sendWaitingAcceptanceEmail()` — `src/lib/email.ts` (เมื่อ passed = true) |

---

## UC14 — ตรวจรับงาน (Customer)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Customer |
| **Page** | `(customer)/jobs/[id]/page.tsx` — inline ในหน้า job detail |
| **API** | `PATCH /api/jobs/:id/accept` — ยืนยันรับงาน → status: `ACCEPTED` |

---

## UC15 — ออกใบแจ้งหนี้ (Accountant)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Accountant |
| **Pages** | `accountant/invoices/page.tsx` — รายการงานรอออก Invoice |
| | `accountant/invoices/[id]/page.tsx` — รายละเอียด Invoice |
| **API** | `POST /api/jobs/:id/invoice` — สร้าง Invoice → status: `UNPAID` |
| **API** | `GET /api/invoices/:id` — ดู Invoice |
| **Notification** | `sendInvoiceIssuedEmail()` — `src/lib/email.ts` |

---

## UC16 — ชำระเงิน (Customer)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | Customer |
| **Pages** | `(customer)/invoices/page.tsx` — รายการใบแจ้งหนี้ |
| | `(customer)/jobs/[id]/invoice/page.tsx` — ฟอร์มชำระเงิน + แนบสลิป |
| **API** | `POST /api/invoices/:id/payment` — บันทึกการชำระ → status: `PAID` |
| **Validation** | `src/lib/validations/payment.ts` |

---

## UC17 — บันทึกประวัติบริการ (System)

| ส่วน | รายละเอียด |
|---|---|
| **Actor** | System (อัตโนมัติ) |
| **Page** | `(customer)/history/page.tsx` — ประวัติการใช้บริการ |
| **API** | `POST /api/jobs/:id/history` — สร้าง ServiceHistory record |
| **Lib** | `src/lib/service-history.ts` — อัปเดต `end_service_date` อัตโนมัติ |
