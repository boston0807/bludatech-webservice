# โครงสร้างฐานข้อมูล (Data Schema) จาก ER Diagram และ Business Process

เอกสารนี้รวบรวมโครงสร้างฐานข้อมูลแบบ relational ที่แปลงมาจาก ER Diagram พร้อมการออกแบบตารางที่ปรับให้กระชับ เพื่อไม่ให้เป็นภาระต่อการทำงานสำรวจหน้างานของช่าง (UC04/UC05) โดยยังคงความครบถ้วนของกระบวนการธุรกิจตั้งแต่ยื่นคำขอจนถึงชำระเงิน (UC01 - UC17)

---

## 1. ตารางข้อมูลหลัก (Core Entities)

### 1.1 Customer (ข้อมูลลูกค้า)
*ใช้รองรับ UC01, UC02, UC03, UC07, UC14, UC16*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `customer_id` | VARCHAR(20) | PK | รหัสลูกค้า |
| `customer_name` | VARCHAR(100) | NOT NULL | ชื่อ-นามสกุล / ชื่อบริษัท |
| `customer_address` | TEXT | NOT NULL | ที่อยู่ |
| `customer_phone` | VARCHAR(20) | NOT NULL | เบอร์โทรศัพท์ |
| `customer_email` | VARCHAR(100) | NULL | อีเมล |
| `tax_id` | VARCHAR(20) | NULL | เลขประจำตัวผู้เสียภาษี |
| `status` | VARCHAR(20) | DEFAULT 'Pending' | สถานะการอนุมัติลูกค้า (Pending, Approved, Rejected) |

---

### 1.2 Employee (ข้อมูลพนักงาน)
*ใช้รองรับการทำงานของ Admin, Technician (ช่าง/หัวหน้าช่าง), Accountant*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `employee_id` | VARCHAR(20) | PK | รหัสพนักงาน |
| `employee_name` | VARCHAR(100) | NOT NULL | ชื่อ-นามสกุล |
| `role` | VARCHAR(20) | NOT NULL | ตำแหน่ง (Admin, Technician, HeadTechnician, Accountant) |

---

### 1.3 Job (ใบงาน/คำขอรับบริการ)
*ตารางหลักเชื่อมโยงกระบวนการทำงาน UC01 - UC17*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `job_id` | VARCHAR(20) | PK | รหัสใบงาน |
| `customer_id` | VARCHAR(20) | FK (Customer) | รหัสลูกค้า |
| `job_type` | VARCHAR(20) | NOT NULL | ประเภทงาน (Installation, Repair, Service) |
| `request_date` | DATETIME | NOT NULL | วันที่ยื่นคำขอ |
| `job_address` | TEXT | NOT NULL | สถานที่ปฏิบัติงาน |
| `job_note` | TEXT | NULL | รายละเอียดคำขอเพิ่มเติม |
| `job_wage` | DECIMAL(10,2) | DEFAULT 0.00 | ประเมินค่าแรง |
| `status` | VARCHAR(30) | NOT NULL | สถานะงาน (Requested, Surveyed, Quoted, Approved, In Progress, Completed, Cancelled) |

---

## 2. ตารางขยายตามประเภทงาน (Job Sub-types)

### 2.1 Job_Installation (งานติดตั้งลิฟต์)
| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `job_id` | VARCHAR(20) | PK, FK (Job) | รหัสใบงาน |
| `building_floor` | INT | NOT NULL | จำนวนชั้นของอาคาร |
| `elevator_brand` | VARCHAR(50) | NULL | ยี่ห้อลิฟต์ |
| `elevator_model` | VARCHAR(50) | NULL | รุ่นลิฟต์ |
| `elevator_type` | VARCHAR(50) | NULL | ประเภทลิฟต์ (เช่น Passenger, Freight) |
| `quantity` | INT | DEFAULT 1 | จำนวนเครื่อง |

### 2.2 Job_Repair (งานซ่อมบำรุง)
| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `job_id` | VARCHAR(20) | PK, FK (Job) | รหัสใบงาน |
| `elevator_model` | VARCHAR(50) | NULL | รุ่นลิฟต์ |
| `quantity` | INT | DEFAULT 1 | จำนวนเครื่อง |

### 2.3 Job_Service (งานบริการ/บำรุงรักษาตามระยะ)
| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `job_id` | VARCHAR(20) | PK, FK (Job) | รหัสใบงาน |
| `elevator_model` | VARCHAR(50) | NULL | รุ่นลิฟต์ |
| `quantity` | INT | DEFAULT 1 | จำนวนเครื่อง |
| `next_service_day` | DATE | NULL | กำหนดการบริการรอบถัดไป |

---

## 3. ตารางประเมินหน้างานและรายการค่าใช้จ่าย (Survey & Expenses)

> **ข้อสังเกตการลดภาระงานสำรวจ:** แยกตาราง `Survey` ให้กรอกเฉพาะข้อมูลจำเป็น เพื่อให้ช่างสำรวจ (UC04) บันทึกข้อมูลได้รวดเร็ว ส่วนการลงรายละเอียดวัสดุ/ค่าใช้จ่ายสามารถทำย้อนหลังในตาราง `Expense` หรือทำในขั้นตอนจัดทำแผนงาน (UC08) ได้

### 3.1 Survey (การสำรวจหน้างาน)
*รองรับ UC04*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `survey_id` | VARCHAR(20) | PK | รหัสการสำรวจ |
| `job_id` | VARCHAR(20) | FK (Job) | รหัสใบงาน |
| `technician_id` | VARCHAR(20) | FK (Employee) | รหัสช่างผู้สำรวจ |
| `survey_date` | DATETIME | NOT NULL | วันเวลาที่สำรวจ |
| `note` | TEXT | NULL | สรุปผลการสำรวจ/สภาพหน้างาน |

### 3.2 Expense (ค่าใช้จ่ายและวัสดุจากการประเมินหน้างาน)
*รองรับ UC05 (หัวหน้าช่างแก้วัสดุ-ประเมินงานใหม่)*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `expense_id` | INT | PK, AUTO_INC | รหัสรายการค่าใช้จ่าย |
| `job_id` | VARCHAR(20) | FK (Job) | รหัสใบงาน |
| `expense_name` | VARCHAR(100) | NOT NULL | ชื่อรายการวัสดุ/ค่าใช้จ่าย |
| `quantity` | INT | DEFAULT 1 | จำนวน |
| `price` | DECIMAL(10,2) | NOT NULL | ราคาต่อหน่วย |

---

## 4. ตารางใบเสนอราคาและแผนการทำงาน (Quotation & WorkPlan)

### 4.1 Quotation (ใบเสนอราคา)
*รองรับ UC06*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `quotation_id` | VARCHAR(20) | PK | รหัสใบเสนอราคา |
| `job_id` | VARCHAR(20) | FK (Job) | รหัสใบงาน |
| `file_data` | LONGBLOB | NULL | ไฟล์เอกสารใบเสนอราคา (byte) |
| `total_amount` | DECIMAL(10,2) | NOT NULL | ยอดเงินรวมเสนอราคา |
| `status` | VARCHAR(20) | DEFAULT 'Pending' | สถานะ (Pending, Approved, Rejected) |

### 4.2 WorkPlan (แผนการทำงาน)
*รองรับ UC08, UC09, UC12, UC13*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `plan_id` | VARCHAR(20) | PK | รหัสแผนงาน |
| `job_id` | VARCHAR(20) | FK (Job) | รหัสใบงาน |
| `survey_id` | VARCHAR(20) | FK (Survey) | รหัสการสำรวจอ้างอิง |
| `location` | TEXT | NULL | พื้นที่ปฏิบัติงาน |
| `start_date` | DATETIME | NOT NULL | วันเวลาเริ่มต้น |
| `end_date` | DATETIME | NOT NULL | วันเวลาสิ้นสุด |
| `status` | VARCHAR(20) | DEFAULT 'Draft' | สถานะแผนงาน (Draft, Approved, In Progress, Finished) |

---

## 5. ตารางคลังอุปกรณ์และอะไหล่ (Material & Inventory)

### 5.1 Material (รายการอะไหล่และอุปกรณ์)
*รองรับ UC10, UC11*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `material_id` | VARCHAR(20) | PK | รหัสอะไหล่/อุปกรณ์ |
| `material_name` | VARCHAR(100) | NOT NULL | ชื่ออุปกรณ์/อะไหล่ |
| `price` | DECIMAL(10,2) | NOT NULL | ราคาต่อหน่วย |
| `stock_quantity` | INT | DEFAULT 0 | จำนวนคงเหลือในคลัง |

### 5.2 WorkPlan_Material (การจอง/ใช้อุปกรณ์ตามแผนงาน)
*รองรับ UC08, UC10 (ความสัมพันธ์ M:N ระหว่าง WorkPlan และ Material)*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `plan_id` | VARCHAR(20) | PK, FK (WorkPlan) | รหัสแผนงาน |
| `material_id` | VARCHAR(20) | PK, FK (Material) | รหัสอุปกรณ์ |
| `quantity` | INT | NOT NULL | จำนวนที่จอง/ใช้งาน |

---

## 6. ตารางการเงินและการชำระเงิน (Receipt & Payment)

### 6.1 Receipt (ใบแจ้งหนี้ / ใบเสร็จ)
*รองรับ UC15*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `receipt_id` | VARCHAR(20) | PK | รหัสใบแจ้งหนี้ |
| `job_id` | VARCHAR(20) | FK (Job) | รหัสใบงาน |
| `employee_id` | VARCHAR(20) | FK (Employee) | รหัสพนักงานบัญชีที่ออกใบแจ้งหนี้ |
| `total_amount` | DECIMAL(10,2) | NOT NULL | ยอดเงินรวมสุทธิ |
| `status` | VARCHAR(20) | DEFAULT 'Unpaid' | สถานะ (Unpaid, Paid, Cancelled) |

### 6.2 Payment (การชำระเงิน)
*รองรับ UC16*

| Field Name | Data Type | Constraint | Description |
| :--- | :--- | :--- | :--- |
| `payment_id` | VARCHAR(20) | PK | รหัสรายการชำระเงิน |
| `receipt_id` | VARCHAR(20) | FK (Receipt) | รหัสใบแจ้งหนี้ |
| `payment_date` | DATETIME | NOT NULL | วันเวลาที่ชำระเงิน |
| `amount` | DECIMAL(10,2) | NOT NULL | จำนวนเงินที่ชำระ |
| `payment_method` | VARCHAR(30) | NOT NULL | วิธีการชำระเงิน (Transfer, Cash, Credit Card) |

---

## 7. สรุปการเชื่อมโยงความสัมพันธ์ (Entity Relationships Summary)

1. **Customer (1) — (M) Job:** ลูกค้า 1 รายสามารถสร้างคำขอรับบริการได้หลายใบงาน
2. **Job (1) — (1) Job Subtype:** ใบงานมีรายละเอียดเจาะจงตามประเภท (Installation / Repair / Service) แบบ 1 ต่อ 1
3. **Job (1) — (M) Survey:** ใบงานสามารถเข้าสำรวจหน้างานได้ (ปกติ 1 ครั้ง หรือสำรวจซ้ำกรณีต้องปรับแก้)
4. **Job (1) — (M) Expense:** รายการค่าใช้จ่ายจากการประเมินยึดโยงกับใบงาน
5. **Job (1) — (1) Quotation:** ใบงานมีใบเสนอราคาหลัก 1 ฉบับ
6. **Job (1) — (1) WorkPlan:** ใบงานมีแผนปฏิบัติงาน 1 แผนหลัก
7. **WorkPlan (M) — (N) Material:** แผนงาน 1 แผนสามารถเบิก/จองใช้อะไหล่ได้หลายรายการ ผ่านตารางกลาง `WorkPlan_Material`
8. **Job (1) — (1) Receipt:** ใบงานที่เสร็จสิ้นจะถูกนำไปออกใบแจ้งหนี้ 1 ฉบับ
9. **Receipt (1) — (M) Payment:** ใบแจ้งหนี้ 1 ฉบับสามารถมีรายการชำระเงินได้ (รองรับการมัดจำ/ผ่อนชำระ)