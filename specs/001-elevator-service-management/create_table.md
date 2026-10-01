# SQL — Create Database สำหรับระบบบริหารจัดการลิฟต์โดยสาร

> **Database:** PostgreSQL  
> **อ้างอิงจาก:** `prisma/schema.prisma`  
> รันคำสั่งตามลำดับที่กำหนด เพราะมี Foreign Key dependency ระหว่างตาราง

---

## ขั้นตอนที่ 1 — สร้าง Database

```sql
CREATE DATABASE elevator_db
    WITH
    OWNER = postgres
    ENCODING = 'UTF8'
    LC_COLLATE = 'en_US.UTF-8'
    LC_CTYPE = 'en_US.UTF-8'
    TEMPLATE = template0;
```

---

## ขั้นตอนที่ 2 — สร้าง ENUM Types

```sql
-- สถานะลูกค้า
CREATE TYPE "CustomerStatus" AS ENUM (
    'PENDING',
    'ACTIVE',
    'REJECTED'
);

-- บทบาทพนักงาน
CREATE TYPE "EmployeeRole" AS ENUM (
    'ADMIN',
    'TECHNICIAN',
    'HEAD_TECHNICIAN',
    'ACCOUNTANT'
);

-- ประเภทใบงาน
CREATE TYPE "JobType" AS ENUM (
    'INSTALLATION',
    'REPAIR',
    'SERVICE'
);

-- สถานะใบงาน
CREATE TYPE "JobStatus" AS ENUM (
    'PENDING',
    'PASS_SURVEY',
    'QUOTED',
    'REQUEST_EDIT',
    'APPROVE',
    'PLAN_APPROVED',
    'IN_PROGRESS',
    'WAITING_ACCEPTANCE',
    'ACCEPTED',
    'PAID',
    'COMPLETED',
    'CANCELLED'
);

-- สถานะใบเสนอราคา
CREATE TYPE "QuotationStatus" AS ENUM (
    'PENDING',
    'APPROVED',
    'REJECTED'
);

-- สถานะแผนงาน
CREATE TYPE "WorkPlanStatus" AS ENUM (
    'DRAFT',
    'APPROVED',
    'IN_PROGRESS',
    'FINISHED'
);

-- สถานะใบแจ้งหนี้
CREATE TYPE "ReceiptStatus" AS ENUM (
    'UNPAID',
    'PAID',
    'CANCELLED'
);

-- วิธีชำระเงิน
CREATE TYPE "PaymentMethod" AS ENUM (
    'TRANSFER',
    'CASH',
    'CREDIT_CARD'
);
```

---

## ขั้นตอนที่ 3 — สร้างตารางหลัก (Core Tables)

### 3.1 ตาราง customers

```sql
CREATE TABLE customers (
    customer_id     VARCHAR(30)      NOT NULL,
    username        VARCHAR(50)      NOT NULL,
    password        VARCHAR(255)     NOT NULL,
    customer_name   VARCHAR(100)     NOT NULL,
    customer_address TEXT            NOT NULL,
    customer_phone  VARCHAR(20)      NOT NULL,
    customer_email  VARCHAR(100),
    tax_id          VARCHAR(20),
    status          "CustomerStatus" NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3)     NOT NULL,

    CONSTRAINT customers_pkey PRIMARY KEY (customer_id),
    CONSTRAINT customers_username_key UNIQUE (username)
);
```

### 3.2 ตาราง employees

```sql
CREATE TABLE employees (
    employee_id     VARCHAR(30)      NOT NULL,
    username        VARCHAR(50)      NOT NULL,
    password        VARCHAR(255)     NOT NULL,
    employee_name   VARCHAR(100)     NOT NULL,
    role            "EmployeeRole"   NOT NULL,
    created_at      TIMESTAMP(3)     NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3)     NOT NULL,

    CONSTRAINT employees_pkey PRIMARY KEY (employee_id),
    CONSTRAINT employees_username_key UNIQUE (username)
);
```

### 3.3 ตาราง jobs

```sql
CREATE TABLE jobs (
    job_id          VARCHAR(30)     NOT NULL,
    customer_id     VARCHAR(30)     NOT NULL,
    job_type        "JobType"       NOT NULL,
    request_date    TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    job_address     TEXT            NOT NULL,
    job_note        TEXT,
    job_wage        DECIMAL(10, 2)  NOT NULL DEFAULT 0.00,
    status          "JobStatus"     NOT NULL DEFAULT 'PENDING',
    created_at      TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3)    NOT NULL,

    CONSTRAINT jobs_pkey PRIMARY KEY (job_id),
    CONSTRAINT jobs_customer_id_fkey
        FOREIGN KEY (customer_id)
        REFERENCES customers (customer_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

---

## ขั้นตอนที่ 4 — สร้างตาราง Job Subtypes (1:1 กับ jobs)

### 4.1 ตาราง job_installations (งานติดตั้ง)

```sql
CREATE TABLE job_installations (
    job_id          VARCHAR(30)     NOT NULL,
    building_floor  INTEGER         NOT NULL,
    elevator_brand  VARCHAR(50),
    elevator_model  VARCHAR(50),
    elevator_type   VARCHAR(50),
    quantity        INTEGER         NOT NULL DEFAULT 1,

    CONSTRAINT job_installations_pkey PRIMARY KEY (job_id),
    CONSTRAINT job_installations_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
```

### 4.2 ตาราง job_repairs (งานซ่อม)

```sql
CREATE TABLE job_repairs (
    job_id          VARCHAR(30)     NOT NULL,
    elevator_model  VARCHAR(50),
    quantity        INTEGER         NOT NULL DEFAULT 1,

    CONSTRAINT job_repairs_pkey PRIMARY KEY (job_id),
    CONSTRAINT job_repairs_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
```

### 4.3 ตาราง job_services (งานบำรุงรักษา)

```sql
CREATE TABLE job_services (
    job_id              VARCHAR(30)     NOT NULL,
    elevator_model      VARCHAR(50),
    quantity            INTEGER         NOT NULL DEFAULT 1,
    end_service_date    TIMESTAMP(3),

    CONSTRAINT job_services_pkey PRIMARY KEY (job_id),
    CONSTRAINT job_services_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE
);
```

---

## ขั้นตอนที่ 5 — สร้างตาราง Survey & Expense

### 5.1 ตาราง surveys (การสำรวจหน้างาน)

```sql
CREATE TABLE surveys (
    survey_id       VARCHAR(30)     NOT NULL,
    job_id          VARCHAR(30)     NOT NULL,
    technician_id   VARCHAR(30)     NOT NULL,
    survey_date     TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,
    note            TEXT,

    CONSTRAINT surveys_pkey PRIMARY KEY (survey_id),
    CONSTRAINT surveys_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT surveys_technician_id_fkey
        FOREIGN KEY (technician_id)
        REFERENCES employees (employee_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

### 5.2 ตาราง expenses (รายการค่าใช้จ่าย / อะไหล่)

```sql
CREATE TABLE expenses (
    expense_id      SERIAL          NOT NULL,
    job_id          VARCHAR(30)     NOT NULL,
    expense_name    VARCHAR(100)    NOT NULL,
    quantity        INTEGER         NOT NULL DEFAULT 1,
    price           DECIMAL(10, 2)  NOT NULL,

    CONSTRAINT expenses_pkey PRIMARY KEY (expense_id),
    CONSTRAINT expenses_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

---

## ขั้นตอนที่ 6 — สร้างตาราง Quotation

```sql
CREATE TABLE quotations (
    quotation_id    VARCHAR(30)         NOT NULL,
    job_id          VARCHAR(30)         NOT NULL,
    file_data       BYTEA,
    total_amount    DECIMAL(10, 2)      NOT NULL,
    status          "QuotationStatus"   NOT NULL DEFAULT 'PENDING',
    reject_note     TEXT,
    created_at      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3)        NOT NULL,

    CONSTRAINT quotations_pkey PRIMARY KEY (quotation_id),
    CONSTRAINT quotations_job_id_key UNIQUE (job_id),
    CONSTRAINT quotations_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

---

## ขั้นตอนที่ 7 — สร้างตาราง WorkPlan & Materials

### 7.1 ตาราง work_plans (แผนการทำงาน)

```sql
CREATE TABLE work_plans (
    plan_id         VARCHAR(30)         NOT NULL,
    job_id          VARCHAR(30)         NOT NULL,
    survey_id       VARCHAR(30),
    location        TEXT,
    start_date      TIMESTAMP(3)        NOT NULL,
    end_date        TIMESTAMP(3)        NOT NULL,
    status          "WorkPlanStatus"    NOT NULL DEFAULT 'DRAFT',
    created_at      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3)        NOT NULL,

    CONSTRAINT work_plans_pkey PRIMARY KEY (plan_id),
    CONSTRAINT work_plans_job_id_key UNIQUE (job_id),
    CONSTRAINT work_plans_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT work_plans_survey_id_fkey
        FOREIGN KEY (survey_id)
        REFERENCES surveys (survey_id)
        ON UPDATE CASCADE
        ON DELETE SET NULL
);
```

### 7.2 ตาราง materials (คลังอะไหล่)

```sql
CREATE TABLE materials (
    material_id     VARCHAR(30)     NOT NULL,
    material_name   VARCHAR(100)    NOT NULL,
    price           DECIMAL(10, 2)  NOT NULL,
    stock_quantity  INTEGER         NOT NULL DEFAULT 0,

    CONSTRAINT materials_pkey PRIMARY KEY (material_id)
);
```

### 7.3 ตาราง work_plan_materials (การจองอะไหล่ตามแผน)

```sql
CREATE TABLE work_plan_materials (
    plan_id         VARCHAR(30)     NOT NULL,
    material_id     VARCHAR(30)     NOT NULL,
    quantity        INTEGER         NOT NULL,

    CONSTRAINT work_plan_materials_pkey PRIMARY KEY (plan_id, material_id),
    CONSTRAINT work_plan_materials_plan_id_fkey
        FOREIGN KEY (plan_id)
        REFERENCES work_plans (plan_id)
        ON UPDATE CASCADE
        ON DELETE CASCADE,
    CONSTRAINT work_plan_materials_material_id_fkey
        FOREIGN KEY (material_id)
        REFERENCES materials (material_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

---

## ขั้นตอนที่ 8 — สร้างตาราง Receipt & Payment

### 8.1 ตาราง receipts (ใบแจ้งหนี้)

```sql
CREATE TABLE receipts (
    receipt_id      VARCHAR(30)         NOT NULL,
    job_id          VARCHAR(30)         NOT NULL,
    employee_id     VARCHAR(30)         NOT NULL,
    total_amount    DECIMAL(10, 2)      NOT NULL,
    status          "ReceiptStatus"     NOT NULL DEFAULT 'UNPAID',
    created_at      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at      TIMESTAMP(3)        NOT NULL,

    CONSTRAINT receipts_pkey PRIMARY KEY (receipt_id),
    CONSTRAINT receipts_job_id_key UNIQUE (job_id),
    CONSTRAINT receipts_job_id_fkey
        FOREIGN KEY (job_id)
        REFERENCES jobs (job_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT,
    CONSTRAINT receipts_employee_id_fkey
        FOREIGN KEY (employee_id)
        REFERENCES employees (employee_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

### 8.2 ตาราง payments (การชำระเงิน)

```sql
CREATE TABLE payments (
    payment_id      VARCHAR(30)         NOT NULL,
    receipt_id      VARCHAR(30)         NOT NULL,
    payment_date    TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,
    amount          DECIMAL(10, 2)      NOT NULL,
    payment_method  "PaymentMethod"     NOT NULL,
    slip_url        TEXT,
    verified        BOOLEAN             NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMP(3)        NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT payments_pkey PRIMARY KEY (payment_id),
    CONSTRAINT payments_receipt_id_fkey
        FOREIGN KEY (receipt_id)
        REFERENCES receipts (receipt_id)
        ON UPDATE CASCADE
        ON DELETE RESTRICT
);
```

---

## ขั้นตอนที่ 9 — สร้างตาราง Service History

```sql
CREATE TABLE service_histories (
    history_id          VARCHAR(30)     NOT NULL,
    job_id              VARCHAR(30)     NOT NULL,
    customer_id         VARCHAR(30)     NOT NULL,
    job_type            "JobType"       NOT NULL,
    completed_date      TIMESTAMP(3)    NOT NULL,
    total_cost          DECIMAL(10, 2)  NOT NULL,
    technician_names    TEXT            NOT NULL,
    summary             TEXT,
    next_service_date   TIMESTAMP(3),
    created_at          TIMESTAMP(3)    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT service_histories_pkey PRIMARY KEY (history_id)
);
```

---

## ขั้นตอนที่ 10 — สร้าง Indexes เพื่อเพิ่มประสิทธิภาพ

```sql
-- Customers: ค้นหาตาม status บ่อย (UC03 - Admin อนุมัติ)
CREATE INDEX idx_customers_status ON customers (status);

-- Jobs: filter ตาม customer และ status
CREATE INDEX idx_jobs_customer_id ON jobs (customer_id);
CREATE INDEX idx_jobs_status ON jobs (status);
CREATE INDEX idx_jobs_type ON jobs (job_type);

-- Surveys: ดึงตาม job
CREATE INDEX idx_surveys_job_id ON surveys (job_id);

-- Expenses: ดึงตาม job
CREATE INDEX idx_expenses_job_id ON expenses (job_id);

-- Quotations: ดึงตาม status
CREATE INDEX idx_quotations_status ON quotations (status);

-- WorkPlans: ดึงตาม status
CREATE INDEX idx_work_plans_status ON work_plans (status);

-- Payments: ดึงตาม receipt
CREATE INDEX idx_payments_receipt_id ON payments (receipt_id);

-- ServiceHistory: ค้นหาตาม customer
CREATE INDEX idx_service_histories_customer_id ON service_histories (customer_id);
CREATE INDEX idx_service_histories_job_id ON service_histories (job_id);
```

---

## ขั้นตอนที่ 11 — Insert ข้อมูลเริ่มต้น (Seed Data)

> **หมายเหตุ:** password ด้านล่างคือ hash ของ `password123` (bcrypt, cost=12)  
> ในการใช้งานจริงให้รัน `npm run db:seed` แทน

```sql
-- Seed Employees
INSERT INTO employees (employee_id, username, password, employee_name, role, created_at, updated_at) VALUES
(
    'emp_admin_001',
    'admin',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAiZ5V8X1VZqx5Hi',
    'สมชาย ธุรการ',
    'ADMIN',
    NOW(),
    NOW()
),
(
    'emp_acc_001',
    'accountant',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAiZ5V8X1VZqx5Hi',
    'สมหญิง บัญชี',
    'ACCOUNTANT',
    NOW(),
    NOW()
),
(
    'emp_head_001',
    'head_tech',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAiZ5V8X1VZqx5Hi',
    'วิชัย หัวหน้าช่าง',
    'HEAD_TECHNICIAN',
    NOW(),
    NOW()
),
(
    'emp_tech_001',
    'tech01',
    '$2a$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxMQJqhN8/LeAiZ5V8X1VZqx5Hi',
    'สมศักดิ์ ช่าง',
    'TECHNICIAN',
    NOW(),
    NOW()
);
```

---

## สรุปตารางทั้งหมด

| ลำดับ | ตาราง | คำอธิบาย | FK ไปยัง |
| :---: | :--- | :--- | :--- |
| 1 | `customers` | ข้อมูลลูกค้า | — |
| 2 | `employees` | ข้อมูลพนักงาน | — |
| 3 | `jobs` | ใบงานหลัก | customers |
| 4 | `job_installations` | รายละเอียดงานติดตั้ง | jobs |
| 5 | `job_repairs` | รายละเอียดงานซ่อม | jobs |
| 6 | `job_services` | รายละเอียดงานบำรุง | jobs |
| 7 | `surveys` | บันทึกการสำรวจหน้างาน | jobs, employees |
| 8 | `expenses` | รายการค่าใช้จ่าย/อะไหล่ | jobs |
| 9 | `quotations` | ใบเสนอราคา | jobs |
| 10 | `work_plans` | แผนการทำงาน | jobs, surveys |
| 11 | `materials` | คลังอะไหล่และอุปกรณ์ | — |
| 12 | `work_plan_materials` | อะไหล่ที่จองตามแผน (M:N) | work_plans, materials |
| 13 | `receipts` | ใบแจ้งหนี้ | jobs, employees |
| 14 | `payments` | รายการชำระเงิน | receipts |
| 15 | `service_histories` | ประวัติการให้บริการ | — |

**รวม 15 ตาราง, 8 ENUM types, 11 Indexes**

---

## วิธีรันด้วย Prisma (แนะนำ)

ถ้าต้องการให้ Prisma จัดการ migration แทนการรัน SQL ด้วยตัวเอง:

```bash
# 1. ตั้งค่า DATABASE_URL ใน .env
# 2. สร้างตาราง + migrate
npx prisma migrate dev --name init

# 3. Seed ข้อมูลเริ่มต้น
npm run db:seed
```
