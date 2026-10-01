# Specification: Elevator Service Management System

## User Scenarios & Testing

### User Scenario 1: Customer Registration and Approval (UC03, UC04)
- **Actor:** Customer, Admin (พนักงานธุรการ)
- **Flow:** 
  1. A new customer accesses the registration page, fills in profile details (name, username, password, tax ID, phone, email, address), and submits the registration.
  2. The system validates input formats (phone number format, email format, required fields) and saves the customer record with `PENDING` status.
  3. The Admin views pending customer registrations in the dashboard, reviews details, and approves or rejects the account.
  4. Upon approval, the customer status updates to `ACTIVE`, enabling system access.

### User Scenario 2: Submitting a Service Request (UC02)
- **Actor:** Customer
- **Flow:**
  1. An active customer logs into the dashboard and initiates a new service request.
  2. The customer selects the service type: Installation, Monthly Maintenance, or Repair.
  3. The customer provides specific details (address, quantity, elevator type/model, building floors, and notes).
  4. The system validates the input, generates a unique job ID, sets the request date, and creates the job with `PENDING` status.

### User Scenario 3: Site Survey & Expense Estimation (UC05)
- **Actor:** Head Mechanic / Technician (หัวหน้าช่าง/ช่าง)
- **Flow:**
  1. The head mechanic selects a pending service job from the queue to conduct a site survey.
  2. The technician inspects the site, records survey notes and measurements into the system, and updates the job status to `PASS-SURVEY`.
  3. The technician or mechanic estimates required spare parts and labor, recording them as expenses/parts list items.

### User Scenario 4: Quotation Generation & Customer Approval (UC06, UC07)
- **Actor:** Accountant (พนักงานบัญชี), Customer
- **Flow:**
  1. The accountant reviews jobs passing survey (`PASS-SURVEY`), compiles material expenses and labor costs, and generates an official Quotation PDF with status `NOT-APPROVE`.
  2. The customer reviews the quotation via their dashboard and can choose to:
     - **Approve**: Updates job status to `APPROVE` and notifies staff.
     - **Request Edit**: Provides feedback/reason, setting job status to `REQUEST-EDIT` for revision.
     - **Cancel**: Cancels the request.

### User Scenario 5: Work Planning, Part Check & Procurement (UC08, UC09, UC10, UC11)
- **Actor:** Head Mechanic, Admin, Accountant / Inventory Staff
- **Flow:**
  1. For approved jobs (`APPROVE`), the head mechanic creates a work plan (assigning dates and technicians) and reserves spare parts.
  2. The admin reviews and approves the work plan (`PLAN_APPROVED`).
  3. The system checks parts inventory:
     - If sufficient, status is marked `READY`.
     - If insufficient, procurement/purchase request is triggered (`BUY_PARTS`) to replenish stock.

### User Scenario 6: Execution, Safety Testing & Customer Acceptance (UC12, UC13, UC14)
- **Actor:** Technician, Customer
- **Flow:**
  1. Once parts are ready and the scheduled date arrives, technicians execute the installation or repair (`IN_PROGRESS`).
  2. Upon completion, technicians perform safety checks and fill out safety checklists.
  3. If tests pass, the job status moves to `WAITING_ACCEPTANCE`. The customer reviews the completed work on-site and provides digital acceptance confirmation (`ACCEPTED`).

### User Scenario 7: Invoicing, Payment & Service History (UC15, UC16, UC17)
- **Actor:** Accountant, Customer, System
- **Flow:**
  1. Following customer acceptance, the accountant issues an Invoice.
  2. The customer makes payment (transfer or card) and uploads the payment slip.
  3. The accountant verifies payment, updates job status to `PAID`, and issues an official receipt.
  4. The system records the job in Service History and schedules the next maintenance date.

---

## Functional Requirements

### FR-01: User Authentication & Authorization
- The system must support role-based access control for Customers, Admin (ธุรการ), Accountants (บัญชี), and Technicians (ช่าง/หัวหน้าช่าง).
- Users must authenticate securely via credentials (username/phone and hashed password).
- Customer accounts require admin approval before granting system access.

### FR-02: Service Request Management
- Customers must be able to submit requests for three distinct service types: Installation, Repair, and Monthly Maintenance.
- Each request must capture mandatory location, quantity, equipment specifications, and description details without allowing null values in required fields.
- The system must automatically generate unique job identifiers and track job lifecycle statuses (`PENDING`, `PASS-SURVEY`, `APPROVE`, `PLAN_APPROVED`, `IN_PROGRESS`, `WAITING_ACCEPTANCE`, `ACCEPTED`, `PAID`, `CANCELLED`).

### FR-03: Site Survey & Material Estimation
- Technicians must be able to record site survey notes and measurements.
- Staff must be able to associate material expenses and labor costs with specific service jobs.

### FR-04: Quotation & Financial Document Generation
- Accountants must be able to generate quotations based on survey and expense data.
- Customers must be able to approve, request revisions for, or reject quotations.
- The system must support generating invoices and payment receipt documents upon job acceptance and payment verification.

### FR-05: Work Planning & Inventory Verification
- Head mechanics must be able to schedule work plans and assign technicians.
- Admins must be able to review and approve work schedules.
- The system must check spare parts inventory against job requirements and flag shortages for procurement.

### FR-06: Execution, Testing & Acceptance Workflow
- Technicians must be able to update job progress and submit safety inspection checklists.
- Customers must be able to inspect and sign off on completed work to trigger the invoicing phase.

---

## Success Criteria

### Quantitative Metrics
- 95% of customer registrations are processed and reviewed by admin within 24 hours.
- Quotation generation time from survey completion is reduced to under 2 hours.
- 100% of financial transactions (invoices, payments, receipts) are accurately tracked and reconciled against job records.
- Service request submission workflow completes in under 3 minutes for customers.

### Qualitative Measures
- Customers report high satisfaction with clear visibility of service status and transparent quotation breakdowns.
- Staff efficiently manage jobs through clear role-based dashboards without operational bottlenecks.
- Complete traceability of elevator service history from initial request to periodic maintenance.

---

## Key Entities

- **Customer**: Profile details, contact info, tax ID, approval status (`PENDING`, `ACTIVE`, `REJECTED`).
- **Employee**: Staff details, roles (`Admin`, `Technician`, `HeadTechnician`, `Accountant`).
- **Job**: Central service order linking customer, job type, request date, address, wage, and lifecycle status.
- **Job Sub-types**: `Job_Installation`, `Job_Repair`, `Job_Service` storing specific elevator parameters (brand, model, floors, quantity, next service date).
- **Survey & Expense**: Site inspection notes, material lists, spare parts, and labor costs.
- **Quotation / Invoice / Payment**: Financial documents tracking pricing, approval states, payment slips, and receipts.
- **Work Plan**: Scheduling details, assigned technicians, and plan approval status.

---

## Assumptions

- Users have internet access and standard web browser capabilities to access the web application.
- Payment slip verification may be performed manually by accountants or integrated with automated receipt checking if configured.
- Standard Thai business tax ID and phone number validation rules apply.
- Elevator maintenance follows standard regulatory safety checklists.

---

## Out of Scope
- Direct hardware integration with IoT elevator sensors for automated real-time fault detection (future phase).
- Multi-currency transactions (system operates in Thai Baht - THB).
