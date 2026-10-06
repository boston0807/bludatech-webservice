# Task List — Elevator Service Web App

> อัปเดตล่าสุด: 7 ตุลาคม 2026 02:20  
> Tech Stack: Next.js 15 · React 19 · TypeScript · Tailwind CSS · shadcn/ui · Prisma · PostgreSQL (Supabase) · Zod · Jose JWT

---

## Sprint 1 — Core Foundation ✅ เสร็จแล้ว

### 🔧 Project Setup
- [x] สร้างโครงสร้างโปรเจกต์ Next.js 15 App Router + TypeScript
- [x] ตั้งค่า Tailwind CSS + shadcn/ui base components
- [x] ตั้งค่า `tsconfig.json`, `next.config.ts`, `postcss.config.mjs`
- [x] สร้าง `.env.example` + `.gitignore`
- [x] ติดตั้ง dependencies ทั้งหมด (`npm install`)

### 🗄️ Database
- [x] เขียน Prisma Schema ครบทุกตาราง (15 ตาราง + 8 ENUMs)
- [x] รัน `prisma db push` เชื่อมต่อ Supabase PostgreSQL
- [x] รัน `prisma generate` สร้าง Prisma Client
- [x] สร้าง seed file + รัน `npm run db:seed` (employees 4 คน)
- [x] สร้างไฟล์ `create_table.md` รวมคำสั่ง SQL

### 🔑 Auth (UC01 + UC02)
- [x] `src/lib/auth.ts` — JWT sign/verify ด้วย `jose` + `getAuthCookieOptions()`
- [x] `src/lib/prisma.ts` — Prisma singleton client
- [x] `src/lib/api-response.ts` — helper functions
- [x] `src/lib/utils.ts` — `cn()` utility
- [x] Zod validation schemas (`auth.ts`, `job.ts`, `survey.ts`, `quotation.ts`, `workplan.ts`, `payment.ts`)
- [x] `POST /api/auth/register` — UC02 สมัครสมาชิก
- [x] `POST /api/auth/login` — UC01 เข้าสู่ระบบ (รองรับ Customer + Employee) + set cookie ถูกต้อง
- [x] `POST /api/auth/logout` — ลบ cookie
- [x] หน้า `/login` — Login form + Suspense boundary + redirect ด้วย `window.location.href`
- [x] หน้า `/register` — Register form + success state
- [x] `src/middleware.ts` — role-based route protection (page routes), API routes auth เอง

### 👑 Admin: อนุมัติลูกค้า (UC03)
- [x] `GET /api/admin/customers` — ดึงรายการตาม status (auth จาก cookie)
- [x] `PATCH /api/admin/customers/:id/approve` — Approve / Reject (auth จาก cookie)
- [x] หน้า `/admin/customers/pending` — รายการรออนุมัติ + Approve/Reject buttons + error handling

### 🏗️ Shared Layout Components
- [x] `AdminSidebar` — sidebar สำหรับ Admin
- [x] `CustomerSidebar` — sidebar สำหรับลูกค้า
- [x] `TechnicianSidebar` — sidebar สำหรับช่าง
- [x] `AccountantSidebar` — sidebar สำหรับบัญชี
- [x] `TopNav` — navbar + logout ทุก role
- [x] Layout files ครบทุก role (`/admin`, `/(customer)`, `/technician`, `/accountant`)
- [x] Dashboard placeholder pages ครบทุก role

---

## Sprint 2 — Service Request Flow ✅ เสร็จแล้ว

### 📋 UC04 — ยื่นคำขอบริการ (Customer)
- [x] `POST /api/jobs` — สร้าง Job (รองรับ 3 ประเภท: Installation/Repair/Service)
- [x] `GET /api/jobs` — รายการ jobs ตาม role (Customer/Admin/Tech/Accountant)
- [x] `GET /api/jobs/:id` — รายละเอียด job + relations ทั้งหมด
- [x] `PATCH /api/jobs/:id` — อัปเดต status/note
- [x] หน้า `/(customer)/jobs/new` — ฟอร์มยื่นคำขอ (เลือกประเภท + กรอกข้อมูล)
- [x] หน้า `/(customer)/jobs` — รายการใบงานของฉัน
- [x] หน้า `/(customer)/jobs/[id]` — รายละเอียด job + 9-step status timeline + quotation actions

### 🔍 UC05 — สำรวจหน้างาน (Head Technician)
- [x] `POST /api/jobs/:id/survey` — บันทึกผลการสำรวจ + อัปเดต status → PASS_SURVEY
- [x] `GET /api/jobs/:id/expenses` — ดูรายการค่าใช้จ่าย
- [x] `POST /api/jobs/:id/expenses` — เพิ่มรายการค่าใช้จ่าย (batch)
- [x] `PATCH /api/jobs/:id/expenses/:expenseId` — แก้ไขรายการ
- [x] `DELETE /api/jobs/:id/expenses/:expenseId` — ลบรายการ
- [x] หน้า `/technician/jobs` — รายการ jobs ทั้งหมด
- [x] หน้า `/technician/jobs/[id]/survey` — ฟอร์มสำรวจ + dynamic expense rows

### 📄 UC06 — จัดทำใบเสนอราคา (Accountant)
- [x] `POST /api/jobs/:id/quotation` — สร้างใบเสนอราคา (transaction: create quotation + update job status)
- [x] `GET /api/jobs/:id/quotation` — ดูใบเสนอราคา
- [x] หน้า `/accountant/quotations` — รายการ jobs สถานะ PASS_SURVEY
- [x] หน้า `/accountant/quotations/[id]` — ฟอร์มสร้างใบเสนอราคา + expenses + auto-calculate

### ✅ UC07 — ลูกค้าอนุมัติ/ปฏิเสธ (Customer)
- [x] `PATCH /api/quotations/:id` — APPROVE / REJECT (+ rejectNote) / CANCEL
- [x] หน้า `/(customer)/jobs/[id]` — แสดงใบเสนอราคา + ปุ่ม Approve/Reject/Cancel (ในหน้า job detail)

---

## Sprint 3 — Planning & Execution ✅ เสร็จแล้ว

### 📅 UC08 — ทำแผนงานและจองอุปกรณ์ (Head Technician)
- [x] `POST /api/jobs/:id/workplan` — สร้างแผนงาน
- [x] `GET /api/workplans/:id` — ดูรายละเอียดแผนงาน
- [x] `POST /api/workplans/:id/materials` — จองวัสดุ
- [x] หน้า `/technician/workplans` — ฟอร์มสร้างแผนงาน + จองวัสดุ

### 📋 UC09 — อนุมัติแผนงาน (Admin)
- [x] `PATCH /api/workplans/:id/approve` — Admin อนุมัติแผน
- [x] หน้า `/admin/workplans/pending` — รายการแผนรออนุมัติ

### 📦 UC10 — ตรวจสอบสต็อกอุปกรณ์
- [x] `GET /api/workplans/:id/materials/check` — เช็กยอดสต็อก vs ที่จอง
- [x] หน้า `/technician/materials` — แสดงผลการตรวจสต็อก

### 🛒 UC11 — สั่งซื้ออุปกรณ์เพิ่ม (Accountant)
- [x] `GET /api/materials` — รายการวัสดุทั้งหมด
- [x] `POST /api/materials` — เพิ่มวัสดุใหม่
- [x] `PATCH /api/materials/:id/stock` — อัปเดตยอดสต็อก
- [x] หน้า `/accountant/purchase` — จัดการการสั่งซื้อและรับเข้าสต็อก

### 🔨 UC12 — ปฏิบัติงาน (Technician)
- [x] `PATCH /api/jobs/:id/start` — อัปเดตสถานะ IN_PROGRESS
- [x] `PATCH /api/jobs/:id/complete` — อัปเดตสถานะเสร็จสิ้น
- [x] หน้า `/technician/workplans` — อัปเดตสถานะการทำงาน

### 🛡️ UC13 — ทดสอบความปลอดภัย (Technician)
- [x] `POST /api/jobs/:id/safety-check` — บันทึกผล Safety Checklist
- [x] หน้า `/technician/workplans` — Safety Checklist form

### 🤝 UC14 — ตรวจรับงาน (Customer)
- [x] `PATCH /api/jobs/:id/accept` — ลูกค้ายืนยันรับงาน
- [x] หน้า `/(customer)/jobs/[id]` — ยืนยันตรวจรับงาน

---

## Sprint 4 — Finance & Close ✅ เสร็จแล้ว

### 🧾 UC15 — ออกใบแจ้งหนี้ (Accountant)
- [x] `POST /api/jobs/:id/invoice` — สร้าง Invoice
- [x] `GET /api/invoices/:id` — ดู Invoice
- [x] หน้า `/accountant/invoices` — รายการ jobs สถานะ ACCEPTED
- [x] หน้า `/accountant/invoices/[id]` — รายละเอียด Invoice

### 💳 UC16 — ชำระเงิน (Customer)
- [x] `POST /api/invoices/:id/payment` — บันทึกการชำระเงิน + อัปเดต status PAID
- [x] หน้า `/(customer)/invoices` — รายการใบแจ้งหนี้
- [x] หน้า `/(customer)/jobs/[id]/invoice` — ฟอร์มชำระเงิน + แนบสลิป

### 📚 UC17 — บันทึกประวัติ (System)
- [x] `POST /api/jobs/:id/history` — สร้าง ServiceHistory record
- [x] อัปเดต `end_service_date` ใน `job_services` อัตโนมัติ
- [x] หน้า `/(customer)/history` — ประวัติการให้บริการ

---

## งานเสริม (Cross-cutting)

### 🔔 Notifications ✅ เสร็จแล้ว
- [x] ส่งอีเมลเมื่อ Admin อนุมัติลูกค้า (UC03) — `sendCustomerApprovalEmail`
- [x] ส่งอีเมลแจ้งลูกค้าเมื่อมีใบเสนอราคา (UC06) — `sendQuotationCreatedEmail`
- [x] ส่งอีเมลแจ้งเมื่องานเสร็จรอตรวจรับ (UC13) — `sendWaitingAcceptanceEmail`
- [x] ส่งอีเมลแจ้ง Invoice (UC15) — `sendInvoiceIssuedEmail`

---

## สรุปความคืบหน้า

| Sprint | งานทั้งหมด | เสร็จแล้ว | คงเหลือ |
| :--- | :---: | :---: | :---: |
| Sprint 1 — Foundation | 28 | ✅ 28 | 0 |
| Sprint 2 — Service Request | 19 | ✅ 19 | 0 |
| Sprint 3 — Planning & Execution | 21 | ✅ 21 | 0 |
| Sprint 4 — Finance & Close | 9 | ✅ 9 | 0 |
| งานเสริม — Notifications | 4 | ✅ 4 | 0 |
| **รวม** | **81** | **81** | **0** |

**ความคืบหน้ารวม: 100% (81/81 tasks)** 🎉

---

## ไฟล์ที่สร้างแล้ว

```
src/
├── app/
│   ├── (auth)/login/          ✅ page.tsx + login-form.tsx
│   ├── (auth)/register/       ✅ page.tsx
│   ├── (customer)/
│   │   ├── layout.tsx         ✅
│   │   ├── dashboard/         ✅ page.tsx
│   │   ├── jobs/              ✅ page.tsx
│   │   └── jobs/new/          ✅ page.tsx
│   ├── admin/
│   │   ├── layout.tsx         ✅
│   │   ├── dashboard/         ✅ page.tsx
│   │   └── customers/pending/ ✅ page.tsx
│   ├── technician/
│   │   ├── layout.tsx         ✅
│   │   ├── dashboard/         ✅ page.tsx
│   │   ├── jobs/              ✅ page.tsx
│   │   └── jobs/[id]/survey/  ✅ page.tsx
│   ├── accountant/
│   │   ├── layout.tsx         ✅
│   │   └── dashboard/         ✅ page.tsx
│   └── api/
│       ├── auth/login/        ✅ route.ts
│       ├── auth/register/     ✅ route.ts
│       ├── auth/logout/       ✅ route.ts
│       ├── admin/customers/   ✅ route.ts
│       ├── admin/customers/[id]/approve/ ✅ route.ts
│       ├── jobs/              ✅ route.ts
│       ├── jobs/[id]/         ✅ route.ts
│       ├── jobs/[id]/survey/  ✅ route.ts
│       └── jobs/[id]/expenses/ ✅ route.ts
├── components/
│   ├── ui/  button, input, label, card, badge  ✅
│   └── layout/  top-nav, admin/customer/technician/accountant-sidebar  ✅
├── lib/
│   ├── auth.ts     ✅
│   ├── prisma.ts   ✅
│   ├── utils.ts    ✅
│   ├── api-response.ts ✅
│   └── validations/  auth, job, survey, quotation, workplan, payment  ✅
└── middleware.ts    ✅
```
