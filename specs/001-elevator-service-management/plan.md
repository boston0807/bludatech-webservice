# Implementation Plan: Elevator Service Management System

## Architectural Overview

The Elevator Service Management System is built as a modern, full-stack web application using **Next.js 15 (App Router)**, **React 19**, **TypeScript**, **Tailwind CSS**, **shadcn/ui**, **Prisma ORM**, and **PostgreSQL (Supabase)**. Authentication is secured via **JWT (`jose`)** and HTTP-only cookies.

---

## Technical Stack & Libraries

- **Framework:** Next.js 15 App Router (Server & Client Components)
- **UI & Styling:** Tailwind CSS, shadcn/ui primitives, Lucide icons
- **Database & ORM:** PostgreSQL (Supabase), Prisma ORM
- **Validation:** Zod schemas for API request validation and form validation
- **Authentication:** JOSE JWT (`jose`), bcrypt password hashing, role-based cookies

---

## Database Architecture & Schema Summary

The database consists of **15 relational tables** and **8 ENUM types**:

### ENUM Types
1. `CustomerStatus` (`PENDING`, `ACTIVE`, `REJECTED`)
2. `EmployeeRole` (`ADMIN`, `TECHNICIAN`, `HEAD_TECHNICIAN`, `ACCOUNTANT`)
3. `JobType` (`INSTALLATION`, `REPAIR`, `SERVICE`)
4. `JobStatus` (`PENDING`, `PASS_SURVEY`, `QUOTED`, `REQUEST_EDIT`, `APPROVE`, `PLAN_APPROVED`, `IN_PROGRESS`, `WAITING_ACCEPTANCE`, `ACCEPTED`, `PAID`, `COMPLETED`, `CANCELLED`)
5. `QuotationStatus` (`PENDING`, `APPROVED`, `REJECTED`)
6. `WorkPlanStatus` (`DRAFT`, `APPROVED`, `IN_PROGRESS`, `FINISHED`)
7. `ReceiptStatus` (`UNPAID`, `PAID`, `CANCELLED`)
8. `PaymentMethod` (`TRANSFER`, `CASH`, `CREDIT_CARD`)

### Core & Subtype Tables
- **Core Entities:** `customers`, `employees`, `jobs`
- **Job Subtypes (1:1 with jobs):** `job_installations`, `job_repairs`, `job_services`
- **Workflow & Process:** `surveys`, `expenses`, `quotations`, `work_plans`, `materials`, `work_plan_materials`
- **Finance & History:** `receipts`, `payments`, `service_histories`

---

## Module Breakdown & Business Flow

```
[Customer Register (UC02)] → [Admin Approve (UC03)] → [Submit Job (UC04)]
        ↓
[Site Survey & Expense (UC05)] → [Quotation Generation (UC06)] → [Customer Approval (UC07)]
        ↓
[Work Plan & Part Reservation (UC08)] → [Admin Plan Approval (UC09)]
        ↓
[Stock Check (UC10) / Purchase (UC11)] → [Execution (UC12)] → [Safety Check (UC13)]
        ↓
[Customer Acceptance (UC14)] → [Issue Invoice (UC15)] → [Payment & Receipt (UC16)] → [Service History (UC17)]
```

---

## Role-Based Access Control (RBAC) & Routes

| Role | Key Pages / Endpoints |
| :--- | :--- |
| **Customer** | `/dashboard`, `/jobs/new`, `/jobs/:id`, `/invoices` |
| **Admin** | `/admin/dashboard`, `/admin/customers/pending`, `/admin/workplans/pending` |
| **Technician / Head Tech** | `/technician/dashboard`, `/technician/jobs`, `/technician/jobs/:id/survey`, `/technician/jobs/:id/workplan` |
| **Accountant** | `/accountant/dashboard`, `/accountant/quotations`, `/accountant/purchase`, `/accountant/invoices` |

---

## Phased Implementation Strategy (Sprints)

- **Sprint 1 (Completed):** Foundation, Prisma Schema & Seed, Auth (UC01-UC02), Admin Customer Approval (UC03), Base UI Layouts.
- **Sprint 2 (Completed):** Service Request (UC04), Site Survey & Expenses (UC05), Quotation Generation (UC06), Customer Quotation Approval (UC07).
- **Sprint 3 (Pending):** Work Planning & Part Reservation (UC08), Plan Approval (UC09), Stock Check (UC10), Procurement (UC11), Execution (UC12), Safety Inspection (UC13), Customer Acceptance (UC14).
- **Sprint 4 (Pending):** Invoice Issuance (UC15), Payment & Slip Upload (UC16), Service History & Maintenance Scheduling (UC17), Notifications & Polish.
