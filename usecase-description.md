# Use Case Description

ระบบบริการติดตั้งและซ่อมบำรุงลิฟต์โดยสาร

---

## UC01 — เข้าสู่ระบบ (Login)

- **คำอธิบาย:** ลูกค้าเข้าสู่ระบบของแอป
- **Precondition:** เคยลงทะเบียนสร้าง Account มาก่อน
- **Actor:** Customer
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้า login |
| 2 | กรอกข้อมูล `customer_email` หรือเบอร์ และรหัสผ่าน |  |
| 3 | ยืนยันการเข้าสู่ระบบ |  |
| 4 |  | เช็คข้อมูล `customer_name` และ `password` ว่าไม่เป็น empty string |
| 5 |  | ค้นหา customer ด้วย `customer_name` หรือเบอร์ในฐานข้อมูล และเช็ค `status` ว่าเป็น `ACTIVE` |
| 6 |  | เช็คว่า `password` ของผู้ใช้ในฐานข้อมูลตรงกับที่กรอกมา |
| 7 |  | ทำการ login customer และ redirect ไปยัง welcome page |

```sql
-- 5
SELECT customer_id, username, password, status FROM customer
WHERE (username = $1 OR phone_number = $1) AND status = 'ACTIVE';

-- 6
SELECT password FROM customer WHERE customer_name = $1;
```

---

## UC02 — ยื่นคำขอ

- **คำอธิบาย:** ลูกค้ายื่นคำขอติดตั้งหรือซ่อม-บำรุงลิฟต์โดยสารผ่าน web application
- **Precondition:** ลูกค้าต้องมีการ Login ผ่าน UC01 มาก่อน
- **Actor:** Customer
- **System:** Web Application

### Normal Flow (กรณีติดตั้งลิฟต์)

| # | Actor | System |
|---|---|---|
| 1 |  | รับ `customer_id` มาจากขั้นตอน Login และแสดง Type ของการให้บริการ 3 Type (ติดตั้ง, บำรุงรายเดือน, ซ่อมรายครั้ง) ให้ customer เลือก |
| 2 | เลือกประเภทการใช้บริการติดตั้งลิฟต์ |  |
| 3 |  | แสดงหน้าการกรอกข้อมูลสำหรับการติดตั้งลิฟต์ |
| 4 | กรอกข้อมูลการใช้บริการตามที่ระบบแสดง ได้แก่ `address`, `elevator_brand`, `quantity` และเลือก `elevator_type` |  |
| 5 | กดยืนยันการใช้บริการ |  |
| 6 |  | ตรวจสอบข้อมูลที่ลูกค้ากรอก (6.1 ตรวจสอบว่าไม่มี null และ empty string ในทุกๆ field) |
| 7 |  | Generate `job_id` ด้วยฟังก์ชัน `genJobID` และ get ค่า DateTime เก็บใน `request_date`, ค่า `status` = `PENDING`, ค่า `fee` = null |
| 8 |  | insert ข้อมูลลงตาราง `job` และ `installation` |
| 9 |  | แสดงหน้าต่าง Request Complete |

```sql
-- 8
INSERT INTO job(job_id, status, job_address, request_date)
VALUES ($1, 'PENDING', $2, $3);

INSERT INTO installation(job_id, elevator_brand, quantity, elevator_type)
VALUES ($1, $2, $3, $4);
```

### Alternative Flow 2a (กรณีบำรุงรายเดือน)

| # | Actor | System |
|---|---|---|
| 2a | เลือกประเภทการใช้บริการบำรุงรายเดือน |  |
| 2a.1 |  | แสดงหน้าการกรอกข้อมูลสำหรับการบำรุงรายเดือน |
| 2a.2 | กรอกข้อมูลการใช้บริการ ได้แก่ `job_address`, `elevator_type` และ `quantity` |  |
| 2a.3 | กดยืนยันการใช้บริการ |  |
| 2a.4 |  | ตรวจสอบข้อมูล (2a.4.1 ตรวจสอบว่าไม่มี null และ empty string ในทุกๆ field) |
| 2a.5 |  | Generate `job_id` ด้วย `genJobID` และ get ค่า DateTime ด้วย `NOW()` เก็บใน `request_date`, `status` = `PENDING`, `fee` = null |
| 2a.6 |  | insert ข้อมูลลงตาราง `monthly_maintenance` โดย `fee` และ `next_service_day` = null |
| 2a.7 |  | แสดงหน้าต่าง Request Complete |

```sql
-- 2a.6
INSERT INTO monthly_maintenance(job_id, job_type, request_date, job_address, elevator_type, quantity)
VALUES ($1, $2, $3, $4, $5, $6);
```

### Alternative Flow 2b (กรณีซ่อมรายครั้ง)

| # | Actor | System |
|---|---|---|
| 2b | เลือกประเภทการใช้บริการซ่อมรายครั้ง |  |
| 2b.1 |  | แสดงหน้าการกรอกข้อมูลสำหรับการซ่อมรายครั้ง |
| 2b.2 | กรอกข้อมูลการใช้บริการ ได้แก่ `job_address`, `elevator_type` และ `quantity` |  |
| 2b.3 | กดยืนยันการใช้บริการ |  |
| 2b.4 |  | ตรวจสอบข้อมูล (2b.4.1 ตรวจสอบว่าไม่มี null และ empty string ในทุกๆ field) |
| 2b.5 |  | Generate `job_id` และ Generate ค่า DateTime เก็บใน `request_date` |
| 2b.6 |  | insert ข้อมูลลงตาราง `repair`, set `status` = `PENDING`, `fee` และ `repair_day` = null |
| 2b.7 |  | แสดงหน้าต่าง Request Complete |

```sql
-- 2b.6
INSERT INTO repair(job_id, job_type, request_date, job_address, elevator_type, quantity)
VALUES ($1, $2, $3, $4, $5, $6);
```

### Exception Flow 6a (กรอกข้อมูลไม่ครบ)

- **6a** ตรวจพบว่ามี field ที่เป็น null หรือ empty string (เกิดได้ที่ขั้นตอน 6, 2a.4 และ 2b.4)
- **6a.1** แสดงข้อความแจ้งเตือนให้กรอกข้อมูลให้ครบทุก field และไม่บันทึกข้อมูล
- **6a.2** กลับไปที่หน้ากรอกข้อมูล (ขั้นตอนที่ 4, 2a.2 หรือ 2b.2) โดยคงข้อมูลที่กรอกไว้

### Exception Flow 8a (บันทึกข้อมูลไม่สำเร็จ)

- **8a** insert ข้อมูลลงฐานข้อมูลไม่สำเร็จ (เกิดได้ที่ขั้นตอน 8, 2a.6 และ 2b.6)
- **8a.1** ยกเลิกการบันทึกทั้งหมด (rollback) และไม่สร้าง job
- **8a.2** แสดงข้อความแจ้งเตือนว่ายื่นคำขอไม่สำเร็จ ให้ลองใหม่อีกครั้ง

---

## UC03 — ลงทะเบียนลูกค้าใหม่

- **คำอธิบาย:** ลูกค้าใหม่ลงทะเบียนการใช้งานผ่านระบบ web application
- **Precondition:** —
- **Actor:** Customer
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้าจอสำหรับ Register |
| 2 | กรอกข้อมูล `customer_name`, Password, Confirm Password, Name, Lastname, เลขประจำตัวผู้เสียภาษี, เบอร์โทร, Email, ที่อยู่ |  |
| 3 | กดปุ่มยืนยัน |  |
| 4 |  | ตรวจสอบความถูกต้องของข้อมูล (4.1 empty string, 4.2 Null, 4.3 format เบอร์โทร: ขึ้นต้นด้วย 0, ตัวที่สองเป็น 6/8/9, ยาว 10 ตัว, 4.4 format Email `@gmail.com`) |
| 5 |  | บันทึกข้อมูลลงตาราง `customer` และ set `status` = `PENDING` |
| 6 |  | แสดงข้อความ "ลงทะเบียนสำเร็จ" และนำไปหน้าถัดไป |

```sql
-- 5
INSERT INTO customer(username, password, first_name, last_name, tax_id, phone_number, email, address, status)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'PENDING');
```

---

## UC04 — อนุมัติข้อมูลลูกค้า

- **คำอธิบาย:** พนักงานอนุมัติข้อมูลการสมัครสมาชิกของลูกค้า
- **Precondition:** ผ่านการ register มาแล้ว (ในตาราง customer มี `status` = `PENDING`)
- **Actor:** พนักงาน
- **System:** Web Application

### Normal Flow (กรณี approve)

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้าจอรายการ customer ที่มี `status` = `PENDING` |
| 2 | เลือก customer ที่ต้องการอนุมัติ |  |
| 3 |  | แสดงข้อมูลทั้งหมดของ customer ที่เลือก |
| 4 | พนักงานตรวจสอบข้อมูลและกด approve |  |
| 5 |  | เปลี่ยน `status` ของ customer เป็น `APPROVE` และบันทึกในฐานข้อมูล |
| 6 |  | แจ้งไปที่ email ของ customer ว่าได้รับการอนุมัติ |

```sql
-- 1
SELECT customer_name, phone_number FROM customer WHERE status = 'PENDING';

-- 3
SELECT * FROM customer WHERE customer_name = $1;
```

### Alternative Flow 4a (กรณี reject)

| # | Actor | System |
|---|---|---|
| 4a | พนักงานตรวจสอบข้อมูลและกด reject |  |
| 4a.1 |  | แจ้งไปที่ email ของ customer ว่าไม่ผ่านการอนุมัติ |
| 4a.2 |  | ลบข้อมูลของ customer ออกจากฐานข้อมูล |

---

## UC05 — สำรวจหรือประเมินหน้างาน

- **คำอธิบาย:** พนักงานช่างเข้าตรวจสอบ-ประเมินหน้างาน
- **Precondition:** ผ่าน UC02 มาแล้ว (มี service job สถานะ `PENDING` หรือ `REQUEST-EDIT`)
- **Actor:** ช่าง
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้า List ของ Job ที่ `status` = `PENDING` หรือ `REQUEST-EDIT` ทั้งหมด |
| 2 | ช่างเลือก job ที่สนใจสำรวจหน้างาน |  |
| 3 |  | แสดงหน้าแสดงข้อมูลทั้งหมดของ Job ที่ช่างเลือก |
| 4 | ช่างพิจารณาข้อมูลของ Job และทำการประเมิน-สำรวจหน้างาน |  |
| 5 | เมื่อประเมินสำเร็จ กดยืนยันสำรวจหน้างาน กรอกรายละเอียดให้ครบและกดยืนยันส่งผลสำรวจ |  |
| 6 |  | อัปเดต `status` ของ job เป็น `PASS-SURVEY` และบันทึกข้อมูลการสำรวจลงตาราง `survey` |
| 7 |  | แสดงหน้ากรอกข้อมูลการประเมินอะไหล่และค่าใช้จ่าย |
| 8 | กรอกชื่ออะไหล่ที่ต้องใช้พร้อมจำนวนและราคาต่อชิ้น |  |
| 9 | กดยืนยันการประเมินอะไหล่และค่าใช้จ่าย |  |
| 10 |  | สร้างรายการอะไหล่-ค่าใช้จ่ายสำหรับ job ในตาราง `expense` |

```sql
-- 1
SELECT job_id, job_address, job_type FROM service_job
WHERE status = 'PENDING' OR status = 'REQUEST-EDIT';

-- 3
SELECT * FROM $1 WHERE job_id = $2;  -- $1 = job_type

-- 6
UPDATE service_job SET status = 'PASS-SURVEY' WHERE job_id = $1;

INSERT INTO survey(survey_id, job_id, floor_count, shaft_depth, shaft_height, shaft_width, survey_note)
VALUES ($1, $2, $3, $4, $5, $6, $7);

-- 10
INSERT INTO expense(job_id, expense_name, price, quantity) VALUES ($1, $2, $3, $4);
```

---

## UC06 — ประเมินราคาและจัดทำใบเสนอราคา

- **คำอธิบาย:** พนักงานบัญชีจัดทำใบเสนอราคา
- **Precondition:** ผ่าน UC05 มาแล้ว (job มี `status` = `PASS-SURVEY`)
- **Actor:** พนักงานบัญชี
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้า List ของ job ที่ `status` = `PASS-SURVEY` |
| 2 | เลือก job ที่ต้องการทำใบเสนอราคา |  |
| 3 |  | แสดงหน้าต่างและปุ่มสำหรับทำใบเสนอราคาสำหรับข้อมูล job ที่ถูกเลือก |
| 4 | พนักงานบัญชีกดปุ่มจัดทำใบเสนอราคา |  |
| 5 |  | สร้างและแสดงฟอร์มข้อมูลใบเสนอราคาที่ใส่ข้อมูลของ customer, job, expense ลงในไฟล์ pdf แม่แบบ และแสดงช่องสำหรับใส่ค่าบริการ |
| 6 | พนักงานบัญชีเพิ่มค่าแรงลงในช่องกรอกค่าบริการและกดยืนยัน |  |
| 7 |  | เพิ่มค่าบริการลงในตาราง `expense` |
| 8 |  | เพิ่มรายการค่าบริการในใบเสนอราคา สร้าง `quotation_id` ด้วย `createQuotationID` และบันทึกไฟล์ลงตาราง `quotation` |
| 9 |  | แสดงหน้าต่างสร้างใบเสนอราคาสำเร็จ |

```sql
-- 1
SELECT job_id, job_type, job_address FROM service_job WHERE status = 'PASS-SURVEY';

-- 3
SELECT * FROM job WHERE job_id = $1;

-- 5
SELECT customer_name, address, customer_email, phone_number, tax_id FROM customer
WHERE customer_id = $1;

SELECT job_type, address, request_date, quantity FROM job WHERE job_id = $2;
SELECT expense_name, price, quantity FROM expense WHERE job_id = $2;

-- 7
INSERT INTO expense(expense_name, price, quantity, job_id) VALUES ($1, $2, $3, $4);

-- 8
INSERT INTO quotation(quotation_id, job_id, status, pdf_file)
VALUES ($1, $2, 'NOT-APPROVE', $3);
```

---

## UC07 — ยินยอมการบริการ

- **คำอธิบาย:** ลูกค้าพิจารณาอนุมัติ, แก้ไข, หรือยกเลิกใบเสนอราคา
- **Precondition:** ผ่าน UC06 มาแล้ว
- **Actor:** Customer
- **System:** Web Application

### Normal Flow (กรณีอนุมัติ)

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงข้อมูลใบเสนอราคา, รายละเอียดวัสดุ และข้อมูลการประเมินหน้างาน |
| 2 | ลูกค้าตรวจสอบข้อมูลและกดปุ่ม "อนุมัติ" |  |
| 3 |  | เปลี่ยนสถานะ `service_job` จาก `PASS-SURVEY` เป็น `APPROVE` |
| 4 |  | แสดงข้อความ "อนุมัติใบเสนอราคาเรียบร้อยแล้ว" และส่งแจ้งเตือนไปยังเจ้าหน้าที่ |

```sql
-- 3
UPDATE service_job SET status = 'APPROVE' WHERE job_id = $1;
```

### Alternative Flow 2a (กรณีขอแก้ไข)

| # | Actor | System |
|---|---|---|
| 2a | ลูกค้าตรวจสอบข้อมูลและกดปุ่ม "แก้ไข" |  |
| 2a.1 |  | แสดงช่องให้ลูกค้ากรอกเหตุผลที่ต้องการแก้ไข เช่น ขอเปลี่ยนวัสดุ, ปรับงบประมาณ |
| 2a.2 | ลูกค้ากรอกรายละเอียดและกดปุ่ม "ยืนยันการขอแก้ไข" |  |
| 2a.3 |  | เปลี่ยนสถานะ `service_job` จาก `PASS-SURVEY` เป็น `REQUEST-EDIT` และเพิ่มรายละเอียดลงตาราง job |
| 2a.4 |  | แสดงหน้าต่างบันทึกข้อมูลการแก้ไขสำเร็จ |

```sql
-- 2a.3
UPDATE service_job SET status = 'REQUEST-EDIT', job_note = $1 WHERE job_id = $2;
```

### Alternative Flow 2b (กรณียกเลิก)

| # | Actor | System |
|---|---|---|
| 2b | ลูกค้าตรวจสอบข้อมูลและกดปุ่ม "ยกเลิก" |  |
| 2b.1 |  | แสดงป็อปอัพการยืนยันการยกเลิกบริการ |
| 2b.2 | ลูกค้ากดปุ่ม "ยืนยันการยกเลิก" |  |
| 2b.3 |  | เปลี่ยนสถานะรายการเป็น `CANCELLED` |
| 2b.4 |  | แสดงข้อความ "ยกเลิกบริการเรียบร้อยแล้ว" |

```sql
-- 2b.3
UPDATE service_job SET status = 'CANCELLED' WHERE job_id = $1;
```

---

## UC08 — ทำแผนการทำงานและจองอุปกรณ์

- **คำอธิบาย:** หัวหน้าช่างทำแผนการทำงานและจองวัสดุ/อะไหล่สำหรับ job ที่ลูกค้าอนุมัติแล้ว
- **Precondition:** job ได้รับการอนุมัติผ่าน UC07 และมีสถานะ `APPROVE`
- **Actor:** หัวหน้าช่าง
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดง job ที่ได้รับการ approve จาก customer |
| 2 | หัวหน้าช่างเลือกแสดงข้อมูลงานที่ต้องการทำแผนและจองอุปกรณ์ |  |
| 3 |  | แสดงหน้าข้อมูลสำหรับ job ที่ถูกเลือกและปุ่มสำหรับวางแผนและจองอุปกรณ์ |
| 4 | หัวหน้าช่างกรอกข้อมูลแผนงาน |  |
| 5 | หัวหน้าช่างเพิ่มรายการจองวัสดุ/อะไหล่ (`work_plan_materials`): 5.1 เลือกวัสดุจากคลัง (`material_id`), 5.2 กำหนดจำนวนที่ต้องการ (`quantity`) |  |
| 6 | หัวหน้าช่างกดปุ่ม "บันทึกแผนงาน" |  |
| 7 |  | Generate `plan_id` อัตโนมัติ |
| 8 |  | บันทึกแผนงานสถานะ `DRAFT` และบันทึกรายการจองวัสดุ |

```sql
-- 1
SELECT job_id, job_address FROM job WHERE status = 'APPROVE';

-- 3
SELECT job_id, address, customer_id, status, job_type, job_note
FROM job WHERE job_id = $1;
```

---

## UC09 — อนุมัติแผนการทำงาน

- **คำอธิบาย:** อนุมัติแผนการทำงานของ job ที่มีสถานะเป็น `DRAFT`
- **Precondition:** มี Work Plan สถานะ `DRAFT` รออนุมัติ (จาก UC08)
- **Actor:** User (ผู้อนุมัติ)
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงรายการ Work Plan ที่ `status` = `DRAFT` |
| 2 | User เลือกแผนการทำงานและกดดูรายละเอียด |  |
| 3 |  | แสดงข้อมูลเกี่ยวกับ job และ work plan, ผลการ Survey |
| 4 | User กดอนุมัติแผนงาน |  |
| 5 |  | อัปเดตสถานะ Job เป็น `PLAN_APPROVED` |

```sql
-- 1
SELECT plan_id, job_id, status FROM work_plan WHERE status = 'DRAFT';
```

---

## UC10 — ตรวจสอบอะไหล่และอุปกรณ์

- **คำอธิบาย:** พนักงานช่างตรวจสอบจำนวนอะไหล่และอุปกรณ์ในคลัง ว่ามีเพียงพอสำหรับแผนการทำงานที่ได้รับอนุมัติหรือไม่
- **Precondition:** ผ่าน UC09 มาแล้ว (แผนงานได้รับการอนุมัติ)
- **Actor:** ช่าง
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้ารายการอะไหล่และอุปกรณ์ทั้งหมดที่ต้องใช้ใน Job นั้น |
| 2 | ช่างกดปุ่ม "ตรวจสอบสต๊อกอุปกรณ์" |  |
| 3 |  | ดึงข้อมูลจำนวนคงเหลือในคลังสินค้ามาเปรียบเทียบ |
| 4 |  | แสดงผลการเปรียบเทียบสถานะอุปกรณ์แต่ละรายการ (เช่น "เพียงพอ" หรือ "ขาดสต๊อก") |
| 5 | ช่างรับทราบผลการตรวจสอบ (หากมีอุปกรณ์ขาดสต๊อก จะดำเนินการใน UC11) |  |

```sql
-- 1
SELECT item_id, item_name, qty_needed FROM plan_items WHERE job_id = $1;

-- 3
SELECT item_id, stock_qty FROM inventory WHERE item_id IN ($list);
```

---

## UC11 — ซื้ออุปกรณ์เพิ่ม

- **คำอธิบาย:** พนักงานบัญชีสั่งซื้ออะไหล่และวัสดุเพิ่ม
- **Precondition:** ระบบพบว่าวัสดุไม่เพียงพอ (จาก UC10)
- **Actor:** พนักงานบัญชี
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงรายการ Purchase Request (รายการวัสดุที่ขาดสต็อกพร้อมจำนวนที่ต้องสั่งซื้อ) |
| 2 | พนักงานบัญชีตรวจสอบและยืนยันรายการสั่งซื้อ |  |
| 3 | พนักงานบัญชีดำเนินการสั่งซื้อจากซัพพลายเออร์ (ภายนอกระบบ) |  |
| 4 | พนักงานบัญชีบันทึกการรับเข้าคลังในระบบ: 4.1 เลือกรายการวัสดุ, 4.2 กรอกจำนวนที่รับเข้า, 4.3 บันทึกวันที่รับ |  |
| 5 |  | อัปเดต `stock_qty` ในตาราง `inventory` เพิ่มตามจำนวนที่รับ |

```sql
-- 5
UPDATE inventory SET stock_qty = stock_qty + $1 WHERE item_id = $2;
```

---

## UC12 — ติดตั้งและซ่อมบำรุง

- **คำอธิบาย:** การบันทึกงานสำหรับการปฏิบัติหน้า site งาน
- **Precondition:** Work Plan สถานะ `APPROVED`, วัสดุพร้อม, ถึงวันที่กำหนดตามแผน
- **Actor:** ช่าง
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 | ช่างที่ได้รับมอบหมายเข้าระบบและดูรายการงานของตนเองวันนี้ |  |
| 2 | ช่างเลือก Job/Work Plan ที่ต้องทำและกดปุ่ม "เริ่มปฏิบัติงาน" |  |
| 3 |  | อัปเดต Work Plan สถานะเป็น `IN_PROGRESS` และ Job สถานะเป็น `IN_PROGRESS` |
| 4 |  | บันทึกเวลาเริ่มต้นจริง (`actual_start_time`) |
| 5 | ช่างดำเนินการติดตั้งหรือซ่อมบำรุงตามแผน |  |
| 6 | ระหว่างทำงาน ช่างสามารถบันทึกความคืบหน้าหรือปัญหาที่พบ |  |
| 7 | เมื่อปฏิบัติงานแล้วเสร็จ ช่างกดปุ่ม "งานเสร็จสิ้น" |  |
| 8 |  | บันทึกเวลาสิ้นสุดจริง (`actual_end_time`) |

---

## UC13 — ทดสอบระบบและเช็กความปลอดภัย

- **คำอธิบาย:** ทดสอบระบบและตรวจสอบความปลอดภัย
- **Precondition:** งานปฏิบัติการเสร็จสิ้นแล้ว (UC12)
- **Actor:** ช่าง
- **System:** Web Application

### Normal Flow (กรณีผ่านทุกรายการ)

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้า Safety Checklist ทันทีหลังช่างกด "งานเสร็จสิ้น" |
| 2 | ช่างกรอกผลการทดสอบทีละรายการตามเช็กลิสต์มาตรฐาน เช่น 2.1 ประตูลิฟต์, 2.2 ระบบเบรก/สายเคเบิล, 2.3 ไฟฉุกเฉิน, 2.4 แจ้งเตือนเสียง, 2.5 ความเร็ว, 2.6 น้ำหนัก, 2.7 Limit Switch |  |
| 3 | แต่ละรายการกรอกเป็น Pass / Fail พร้อม Comment (ไม่บังคับ) |  |
| 4 |  | ทุกรายการผ่าน (Pass) อัปเดต Job สถานะเป็น `WAITING_ACCEPTANCE` |
| 5 |  | ส่งแจ้งเตือนลูกค้าให้ตรวจรับงาน (UC14) |

### Alternative Flow 4a (กรณีมีรายการ Fail)

| # | Actor | System |
|---|---|---|
| 4a |  | มีรายการที่ Fail อย่างน้อย 1 รายการ |
| 4a.1 |  | แสดงรายการที่ Fail และให้ช่างบันทึกแผนแก้ไข |
| 4a.2 | ช่างบันทึกแผนแก้ไข |  |
| 4a.3 |  | Job สถานะยังคงเป็น `IN_PROGRESS` และวนกลับ UC12 เพื่อแก้ไข |

---

## UC14 — ตรวจรับงาน

- **คำอธิบาย:** ลูกค้าตรวจรับงาน
- **Precondition:** Job สถานะ `WAITING_ACCEPTANCE` (ผ่าน Safety Check จาก UC13)
- **Actor:** Customer
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 | ลูกค้าได้รับ Email/Notification ว่างานเสร็จสิ้นพร้อมให้ตรวจรับ |  |
| 2 | ลูกค้าไปตรวจสอบหน้างานด้วยตนเอง |  |
| 3 | ลูกค้าเข้าระบบและเปิด Job ที่สถานะ `WAITING_ACCEPTANCE` |  |
| 4 |  | แสดงรายละเอียดงาน: ผลการทดสอบความปลอดภัย, ช่างที่ทำงาน, วันที่เสร็จ |
| 5 | ลูกค้ากดปุ่ม "ยืนยันตรวจรับงาน (Accept)" |  |
| 6 |  | แสดงป๊อปอัพยืนยัน "คุณยืนยันการตรวจรับงานนี้ใช่หรือไม่?" |
| 7 | ลูกค้ากด "ยืนยัน" |  |
| 8 |  | อัปเดต Job สถานะเป็น `ACCEPTED` |
| 9 |  | บันทึก Timestamp การตรวจรับ |
| 10 |  | แจ้งเตือนพนักงานบัญชีให้ออกใบแจ้งหนี้ |

---

## UC15 — ออกใบแจ้งหนี้

- **คำอธิบาย:** พนักงานบัญชีได้รับแจ้งเตือนว่ามี Job ที่ตรวจรับแล้วรอออกใบแจ้งหนี้
- **Precondition:** Job สถานะ `ACCEPTED` (ลูกค้าตรวจรับงานแล้ว จาก UC14)
- **Actor:** พนักงานบัญชี
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงรายการ Job สถานะ `ACCEPTED` ที่รอออกใบแจ้งหนี้ |
| 2 | พนักงานบัญชีเลือก Job และกดปุ่ม "ออกใบแจ้งหนี้" |  |
| 3 |  | ดึงข้อมูลอัตโนมัติจากใบเสนอราคาที่อนุมัติแล้ว (3.1 ข้อมูลลูกค้า, 3.2 รายการค่าใช้จ่าย, 3.3 ยอดรวมสุทธิ) |
| 4 | พนักงานบัญชีตรวจสอบข้อมูลและกดปุ่ม "ยืนยันออกใบแจ้งหนี้" |  |
| 5 |  | Generate `invoice_id` อัตโนมัติ |
| 6 |  | บันทึกลงตาราง `invoices` สถานะ `UNPAID` |
| 7 |  | อัปเดต Job สถานะเป็น `WAITING_PAYMENT` |
| 8 |  | ส่งใบแจ้งหนี้ไปยังอีเมลลูกค้า พร้อมรายละเอียดการชำระเงิน |

```sql
-- 6
INSERT INTO invoices(invoice_id, job_id, total_amount, status)
VALUES ($1, $2, $3, 'UNPAID');

-- 7
UPDATE service_job SET status = 'WAITING_PAYMENT' WHERE job_id = $2;
```

---

## UC16 — ชำระเงิน

- **คำอธิบาย:** บันทึกข้อมูลการชำระเงินหลังจากที่งานดำเนินการเสร็จสิ้น
- **Precondition:** Job สถานะ `WAITING_PAYMENT` (จาก UC15)
- **Actor:** พนักงาน
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้า List ของ Job ที่ `status` = `WAITING_PAYMENT` |
| 2 | พนักงานเลือก Job ที่ลูกค้าต้องการชำระเงิน |  |
| 3 |  | แสดงหน้ารายละเอียดค่าใช้จ่าย (ค่าแรง, ค่าอะไหล่) ของ Job ที่เลือก |
| 4 | พนักงานเลือกช่องทางการชำระเงิน กรอกจำนวนเงินที่รับมา และกดปุ่ม "ยืนยันการชำระเงิน" |  |
| 5 |  | บันทึกข้อมูลการรับชำระเงิน ออกใบเสร็จ และอัปเดตสถานะของ Job |

```sql
-- 1
SELECT j.job_id, c.first_name, i.total_amount
FROM service_job j
JOIN customer c ON j.customer_id = c.customer_id
JOIN invoices i ON j.job_id = i.job_id
WHERE j.status = 'WAITING_PAYMENT';

-- 3
SELECT expense_name, price, quantity, (price * quantity) AS subtotal
FROM expense WHERE job_id = $1;

-- 5
INSERT INTO payment_record (job_id, amount, method, payment_date)
VALUES ($1, $2, $3, NOW());

INSERT INTO receipts (receipt_id, job_id, payment_id)
VALUES ($4, $1, $5);

UPDATE service_job SET status = 'PAID' WHERE job_id = $1;
UPDATE invoices SET status = 'PAID' WHERE job_id = $1;
```

---

## UC17 — บันทึกประวัติ

- **คำอธิบาย:** บันทึกสรุปข้อมูลการปฏิบัติงานทั้งหมดเข้าสู่ฐานข้อมูลประวัติการใช้บริการ
- **Precondition:** ผ่าน UC16 มาแล้ว
- **Actor:** พนักงาน
- **System:** Web Application

### Normal Flow

| # | Actor | System |
|---|---|---|
| 1 |  | แสดงหน้า List ของ Job ที่ดำเนินการและชำระเงินเสร็จสิ้นแล้ว |
| 2 | พนักงานเลือก Job ที่ต้องการบันทึกปิดงานและจัดเก็บเข้าประวัติ |  |
| 3 |  | แสดงหน้าต่างสรุปข้อมูลของ Job ทั้งหมด (รายละเอียดการซ่อม, อะไหล่ที่เปลี่ยน, วันที่, ช่างผู้รับผิดชอบ) |
| 4 | พนักงานตรวจสอบข้อมูล พิมพ์หมายเหตุเพิ่มเติม (ถ้ามี) และกด "บันทึกประวัติปิดงาน" |  |
| 5 |  | จัดเก็บข้อมูลลงตารางประวัติ และอัปเดตสถานะเป็นปิดงานถาวร |

```sql
-- 1
SELECT job_id, job_type FROM service_job WHERE status = 'PAID';

-- 3
SELECT *
FROM service_job
LEFT JOIN expense ON service_job.job_id = expense.job_id
LEFT JOIN employee ON service_job.technician_id = employee.employee_id
WHERE service_job.job_id = $1;

-- 5
INSERT INTO service_history (job_id, customer_id, job_type, job_address, total_amount, completed_date, job_note)
SELECT job_id, customer_id, job_type, job_address, total_amount, CURRENT_TIMESTAMP, job_note
FROM service_job
WHERE job_id = $1;
```
