# สรุปการ Implement Web App ระบบบริหารจัดการธุรกิจลิฟต์โดยสาร

> **วันที่จัดทำ:** 1 ตุลาคม 2026  
> **อ้างอิงจาก:** system_use_cases_summary.md, er_diagram_data_schema_business_dictionary.md, CRUD.md

---

## 1. ภาพรวมระบบ

Web Application สำหรับบริหารจัดการกระบวนการบริการลิฟต์โดยสารครบวงจร ตั้งแต่รับคำขอ ไปจนถึงชำระเงินและบันทึกประวัติ โดยรองรับผู้ใช้ 4 กลุ่มหลัก:

| Role | หน้าที่หลัก |
| :--- | :--- |
| **Customer** | ยื่นคำขอ, อนุมัติใบเสนอราคา, ตรวจรับงาน, ชำระเงิน |
| **Admin (ธุรการ)** | อนุมัติสมาชิก, อนุมัติแผนงาน |
| **Technician / Head Technician (ช่าง)** | สำรวจหน้างาน, ทำแผนงาน, ปฏิบัติงาน, ทดสอบความปลอดภัย |
| **Accountant (บัญชี)** | จัดทำใบเสนอราคา, สั่งซื้ออุปกรณ์, ออกใบแจ้งหนี้ |

---

## 2. กระบวนการทำงานหลัก (Business Flow)

```
[ลูกค้าลงทะเบียน] → [Admin อนุมัติ] → [ลูกค้ายื่นคำขอ]
        ↓
[ช่างสำรวจหน้างาน] → [บัญชีจัดทำใบเสนอราคา] → [ลูกค้าอนุมัติ]
        ↓
[ช่างทำแผนงาน + จองอุปกรณ์] → [Admin อนุมัติแผน]
        ↓
[เช็กสต็อก] → (ไม่พอ) → [สั่งซื้อ] → (พร้อม) → [ปฏิบัติงาน]
        ↓
[ทดสอบความปลอดภัย] → [ลูกค้าตรวจรับงาน]
        ↓
[บัญชีออกใบแจ้งหนี้] → [ลูกค้าชำระเงิน] → [บันทึกประวัติ]
```

---

## 3. Use Cases ที่ต้อง Implement (17 UC)

### กลุ่ม Authentication & Registration
| UC | ชื่อ | Actor หลัก | สิ่งที่ต้อง Implement |
| :--- | :--- | :--- | :--- |
| UC01 | เข้าสู่ระบบ | Customer | Login form, JWT/Session, Hash password check, Redirect by role |
| UC02 | ลงทะเบียนลูกค้าใหม่ | Customer (Guest) | Register form, Validation (phone 10 digit, email format), Status = PENDING |
| UC03 | อนุมัติข้อมูลลูกค้า | Admin | รายการ PENDING customers, Approve → ACTIVE + Email, Reject → ลบ/REJECTED |

### กลุ่มการยื่นคำขอและสำรวจ
| UC | ชื่อ | Actor หลัก | สิ่งที่ต้อง Implement |
| :--- | :--- | :--- | :--- |
| UC04 | ยื่นคำขอบริการ | Customer | เลือก Job Type, กรอก address/quantity/elevator_type, Generate job_id, Status = PENDING |
| UC05 | สำรวจ/ประเมินหน้างาน | Head Technician | รายการ PENDING jobs, กรอก Survey form, บันทึก Expense รายการ |

### กลุ่มใบเสนอราคาและการอนุมัติ
| UC | ชื่อ | Actor หลัก | สิ่งที่ต้อง Implement |
| :--- | :--- | :--- | :--- |
| UC06 | จัดทำใบเสนอราคา | Accountant | ดึงข้อมูล Job + Expense, เพิ่มค่าแรง, Generate PDF, Status = NOT-APPROVE |
| UC07 | ลูกค้าอนุมัติ/ปฏิเสธ | Customer | แสดง Quotation, Approve/Request-Edit/Cancel พร้อมเหตุผล |

### กลุ่มวางแผนและจัดการอุปกรณ์
| UC | ชื่อ | Actor หลัก | สิ่งที่ต้อง Implement |
| :--- | :--- | :--- | :--- |
| UC08 | ทำแผนงานและจองอุปกรณ์ | Head Technician | กำหนดวันทำงาน, มอบหมายช่าง, จองวัสดุจากคลัง |
| UC09 | อนุมัติแผนงาน | Admin | ตรวจคิวช่าง, อนุมัติแผน → Status = PLAN_APPROVED |
| UC10 | ตรวจสอบสต็อกอุปกรณ์ | Head Tech / คลัง | เช็กยอดวัสดุ vs ที่จอง, READY หรือแจ้งสั่งซื้อ |
| UC11 | สั่งซื้ออุปกรณ์เพิ่ม | Accountant | Purchase Request, รับเข้าสต็อก, อัปเดต Material stock |

### กลุ่มปฏิบัติงานและตรวจรับ
| UC | ชื่อ | Actor หลัก | สิ่งที่ต้อง Implement |
| :--- | :--- | :--- | :--- |
| UC12 | ติดตั้งและซ่อมบำรุง | Technician | อัปเดต Status = IN_PROGRESS → DONE |
| UC13 | ทดสอบและตรวจสอบความปลอดภัย | Technician | Safety Checklist form, Pass → WAITING_ACCEPTANCE / Fail → วนกลับ UC12 |
| UC14 | ตรวจรับงาน | Customer | แจ้งเตือนลูกค้า, ยืนยันรับงาน → Status = ACCEPTED |

### กลุ่มการเงิน
| UC | ชื่อ | Actor หลัก | สิ่งที่ต้อง Implement |
| :--- | :--- | :--- | :--- |
| UC15 | ออกใบแจ้งหนี้ | Accountant | สร้าง Invoice จาก Quotation, ส่งแจ้งลูกค้า |
| UC16 | ชำระเงิน | Customer | แนบสลิป, บัญชีตรวจสอบ, Status = PAID, ออก Receipt |
| UC17 | บันทึกประวัติ | System | รวบรวมข้อมูล Job ทั้งหมด → Service_History, อัปเดต Next Service Date |

---

## 4. Database Schema ที่ต้องสร้าง (11 ตาราง)

```
┌──────────────────────────────────────────────────────────────┐
│  CORE TABLES                                                 │
│  Customer | Employee | Job                                   │
├──────────────────────────────────────────────────────────────┤
│  JOB SUBTYPE TABLES (1:1 กับ Job)                            │
│  Job_Installation | Job_Repair | Job_Service                 │
├──────────────────────────────────────────────────────────────┤
│  PROCESS TABLES                                              │
│  Survey | Expense | Quotation | WorkPlan                     │
├──────────────────────────────────────────────────────────────┤
│  INVENTORY & FINANCE TABLES                                  │
│  Material | WorkPlan_Material | Receipt | Payment            │
└──────────────────────────────────────────────────────────────┘
```

### Job Status Lifecycle

```
PENDING → PASS-SURVEY → QUOTED → APPROVE → PLAN_APPROVED
       ↑                              ↓
  REQUEST-EDIT                   IN_PROGRESS → WAITING_ACCEPTANCE
                                                      ↓
                                               ACCEPTED → PAID → CLOSED
```

---

## 5. API Endpoints ที่ต้อง Implement

### Auth
- `POST /api/auth/login` — UC01
- `POST /api/auth/register` — UC02

### Customer Management
- `GET /api/admin/customers/pending` — UC03
- `PATCH /api/admin/customers/:id/approve` — UC03
- `DELETE /api/admin/customers/:id` — UC03

### Jobs
- `POST /api/jobs` — UC04 (สร้างคำขอ)
- `GET /api/jobs` — ดูรายการ jobs ตาม role
- `GET /api/jobs/:id` — ดูรายละเอียด job
- `PATCH /api/jobs/:id/status` — อัปเดตสถานะ

### Survey & Expense
- `POST /api/jobs/:id/survey` — UC05
- `POST /api/jobs/:id/expenses` — UC05
- `GET /api/jobs/:id/expenses` — UC06

### Quotation
- `POST /api/jobs/:id/quotation` — UC06
- `GET /api/jobs/:id/quotation` — UC07
- `PATCH /api/quotations/:id/approve` — UC07
- `PATCH /api/quotations/:id/reject` — UC07

### WorkPlan & Material
- `POST /api/jobs/:id/workplan` — UC08
- `POST /api/workplans/:id/materials` — UC08
- `PATCH /api/workplans/:id/approve` — UC09
- `GET /api/workplans/:id/materials/check` — UC10
- `POST /api/materials/purchase` — UC11

### Execution
- `PATCH /api/jobs/:id/start` — UC12 (IN_PROGRESS)
- `POST /api/jobs/:id/safety-check` — UC13
- `PATCH /api/jobs/:id/accept` — UC14

### Finance
- `POST /api/jobs/:id/invoice` — UC15
- `POST /api/invoices/:id/payment` — UC16
- `POST /api/jobs/:id/history` — UC17

---

## 6. Frontend Pages ที่ต้องสร้าง

### ส่วน Customer
| หน้า | UC ที่เกี่ยวข้อง |
| :--- | :--- |
| `/login` | UC01 |
| `/register` | UC02 |
| `/dashboard` | ภาพรวม jobs ของลูกค้า |
| `/jobs/new` | UC04 — ยื่นคำขอบริการ |
| `/jobs/:id` | ดูรายละเอียด job |
| `/jobs/:id/quotation` | UC07 — อนุมัติ/ปฏิเสธใบเสนอราคา |
| `/jobs/:id/accept` | UC14 — ตรวจรับงาน |
| `/invoices/:id/pay` | UC16 — ชำระเงิน |

### ส่วน Admin (ธุรการ)
| หน้า | UC ที่เกี่ยวข้อง |
| :--- | :--- |
| `/admin/customers/pending` | UC03 — รายการรออนุมัติ |
| `/admin/workplans/pending` | UC09 — รายการแผนรออนุมัติ |

### ส่วน Technician / Head Technician (ช่าง)
| หน้า | UC ที่เกี่ยวข้อง |
| :--- | :--- |
| `/tech/jobs` | รายการ jobs ที่รับผิดชอบ |
| `/tech/jobs/:id/survey` | UC05 — กรอกข้อมูลสำรวจ |
| `/tech/jobs/:id/workplan` | UC08 — จัดทำแผนงาน |
| `/tech/jobs/:id/materials` | UC10 — ตรวจสต็อก |
| `/tech/jobs/:id/work` | UC12 — อัปเดตสถานะงาน |
| `/tech/jobs/:id/safety` | UC13 — Safety Checklist |

### ส่วน Accountant (บัญชี)
| หน้า | UC ที่เกี่ยวข้อง |
| :--- | :--- |
| `/acc/jobs/surveyed` | UC06 — รายการรอทำใบเสนอราคา |
| `/acc/jobs/:id/quotation/create` | UC06 — สร้างใบเสนอราคา |
| `/acc/purchase` | UC11 — สั่งซื้ออุปกรณ์ |
| `/acc/jobs/accepted` | UC15 — รายการรอออกใบแจ้งหนี้ |
| `/acc/invoices/:id` | UC15, UC16 — จัดการ Invoice |

---

## 7. Validation Rules สำคัญ

| ฟิลด์ | กฎ |
| :--- | :--- |
| `customer_phone` | 10 หลัก, ขึ้นต้นด้วย 0 ตามด้วย 6, 8 หรือ 9 (e.g. `06x, 08x, 09x`) |
| `customer_email` | รูปแบบอีเมลมาตรฐาน |
| `password` | Hash ก่อนเก็บ (bcrypt แนะนำ) |
| `job_type` | ต้องเป็น `Installation`, `Repair` หรือ `Service` |
| `quantity` | ต้องเป็นจำนวนเต็มบวก |
| `price`, `amount` | ต้องเป็นตัวเลข ≥ 0, ทศนิยม 2 ตำแหน่ง |
| ฟิลด์ `NOT NULL` ทุกตัว | ต้องไม่เป็นค่าว่าง หรือ empty string |

---

## 8. ลำดับความสำคัญในการ Implement (Suggested Sprint Order)

### Sprint 1 — Core Foundation
1. ตั้งค่า Database + Schema ทั้ง 11 ตาราง
2. Auth: Register (UC02) + Login (UC01)
3. Admin: อนุมัติลูกค้า (UC03)

### Sprint 2 — Service Request Flow
4. Customer: ยื่นคำขอ (UC04) — 3 ประเภท
5. Technician: สำรวจหน้างาน + Expense (UC05)
6. Accountant: ใบเสนอราคา + PDF (UC06)
7. Customer: อนุมัติ/ปฏิเสธ Quotation (UC07)

### Sprint 3 — Planning & Execution
8. Head Technician: แผนงาน + จองอุปกรณ์ (UC08)
9. Admin: อนุมัติแผน (UC09)
10. ตรวจสต็อก (UC10) + สั่งซื้อ (UC11)
11. ช่าง: ปฏิบัติงาน (UC12) + Safety Check (UC13)
12. Customer: ตรวจรับงาน (UC14)

### Sprint 4 — Finance & Close
13. Accountant: Invoice (UC15)
14. Customer: Payment + สลิป (UC16)
15. System: บันทึกประวัติ (UC17)

---

## 9. สรุปจำนวนงานทั้งหมด

| หมวด | จำนวน |
| :--- | :---: |
| Use Cases | 17 |
| Database Tables | 14 (รวม Job subtypes และ history) |
| API Endpoints (ประมาณ) | ~30 |
| Frontend Pages (ประมาณ) | ~20 |
| User Roles | 4 |
| Sprint ที่แนะนำ | 4 |
