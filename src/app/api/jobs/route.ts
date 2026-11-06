// src/app/api/jobs/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { createJobSchema } from "@/lib/validations/job";
import { JobStatus, Prisma } from "@prisma/client";
import { jobTypeParam, optionalDateFilter, searchTerm } from "@/lib/list-filters";
import { technicianJobWhere } from "@/lib/work-schedule";

// GET /api/jobs — ดึง jobs ตาม role
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const statusParam = searchParams.get("status");
  if (statusParam && !(Object.values(JobStatus) as string[]).includes(statusParam)) {
    return errorResponse("status ไม่ถูกต้อง", 422);
  }
  const status = (statusParam as JobStatus | null) ?? undefined;

  // ตัวกรองเพิ่มเติม: ?q=คำค้น &jobType= &from=YYYY-MM-DD &to=YYYY-MM-DD (กรองตามวันที่ยื่นคำขอ)
  const q = searchTerm(searchParams);
  const jobType = jobTypeParam(searchParams);
  const requestDate = optionalDateFilter(searchParams);
  const filters: Prisma.JobWhereInput[] = [];
  if (status) filters.push({ status });
  if (jobType) filters.push({ jobType });
  if (requestDate) filters.push({ requestDate });
  if (q) {
    filters.push({
      OR: [
        { id: { contains: q, mode: "insensitive" } },
        { jobAddress: { contains: q, mode: "insensitive" } },
        { jobNote: { contains: q, mode: "insensitive" } },
        ...(payload.role !== "CUSTOMER"
          ? [
              { customer: { customerName: { contains: q, mode: "insensitive" as const } } },
              { customer: { customerPhone: { contains: q } } },
            ]
          : []),
      ],
    });
  }
  const baseWhere: Prisma.JobWhereInput = filters.length ? { AND: filters } : {};

  let jobs;

  if (payload.role === "CUSTOMER") {
    // ลูกค้าเห็นเฉพาะ jobs ของตัวเอง
    jobs = await prisma.job.findMany({
      where: { ...baseWhere, customerId: payload.sub },
      include: {
        installation: true,
        repair: true,
        service: true,
        workPlan: { select: { id: true, status: true, startDate: true, endDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (payload.role === "ADMIN") {
    jobs = await prisma.job.findMany({
      where: baseWhere,
      include: {
        customer: { select: { customerName: true, customerPhone: true } },
        quotation: { select: { totalAmount: true } },
        receipt: { include: { payments: { orderBy: { paymentDate: "desc" } } } },
        workPlan: { select: { technicians: { select: { employee: { select: { employeeName: true } } } } } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (payload.role === "HEAD_TECHNICIAN" || payload.role === "TECHNICIAN") {
    // หัวหน้าช่างเห็นทุกงาน / ช่างทั่วไปเห็นเฉพาะงานรอสำรวจและงานของตัวเอง
    jobs = await prisma.job.findMany({
      where:
        payload.role === "TECHNICIAN" ? { AND: [baseWhere, technicianJobWhere(payload.sub)] } : baseWhere,
      include: {
        customer: { select: { customerName: true, customerPhone: true } },
        installation: true,
        repair: true,
        service: true,
        workPlan: {
          include: {
            materials: { include: { material: { select: { materialName: true, stockQuantity: true } } } },
            technicians: { include: { employee: { select: { id: true, employeeName: true, role: true } } } },
          },
        },
        safetyChecks: { orderBy: { checkedAt: "desc" }, take: 1 },
        surveys: { orderBy: { surveyDate: "desc" }, take: 1, select: { id: true, method: true, surveyDate: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (payload.role === "ACCOUNTANT") {
    jobs = await prisma.job.findMany({
      where: baseWhere,
      include: {
        customer: { select: { customerName: true, customerPhone: true } },
        quotation: { select: { totalAmount: true } },
        receipt: { select: { id: true, status: true, totalAmount: true } },
      },
      orderBy: { createdAt: "desc" },
    });
  } else {
    return forbiddenResponse();
  }

  return successResponse(jobs);
}

// POST /api/jobs — สร้าง job ใหม่ (Customer เท่านั้น)
export async function POST(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload || payload.role !== "CUSTOMER") return forbiddenResponse();

  const body = await req.json().catch(() => null);
  const parsed = createJobSchema.safeParse(body);
  if (!parsed.success) {
    return errorResponse("ข้อมูลไม่ถูกต้อง", 422, parsed.error.flatten().fieldErrors);
  }

  const { jobType, jobAddress, jobNote, ...subTypeData } = parsed.data;

  try {
    const job = await prisma.job.create({
      data: {
        customerId: payload.sub,
        jobType,
        jobAddress,
        jobNote: jobNote ?? null,
        status: "PENDING",
        // สร้าง subtype ตามประเภทงาน
        ...(jobType === "INSTALLATION" && {
          installation: {
            create: {
              buildingFloor: (subTypeData as { buildingFloor: number }).buildingFloor,
              elevatorBrand: (subTypeData as { elevatorBrand?: string }).elevatorBrand ?? null,
              elevatorModel: (subTypeData as { elevatorModel?: string }).elevatorModel ?? null,
              elevatorType: (subTypeData as { elevatorType?: string }).elevatorType ?? null,
              quantity: (subTypeData as { quantity: number }).quantity,
            },
          },
        }),
        ...(jobType === "REPAIR" && {
          repair: {
            create: {
              elevatorModel: (subTypeData as { elevatorModel?: string }).elevatorModel ?? null,
              quantity: (subTypeData as { quantity: number }).quantity,
            },
          },
        }),
        ...(jobType === "SERVICE" && {
          service: {
            create: {
              elevatorModel: (subTypeData as { elevatorModel?: string }).elevatorModel ?? null,
              quantity: (subTypeData as { quantity: number }).quantity,
            },
          },
        }),
      },
      include: { installation: true, repair: true, service: true },
    });

    return successResponse(job, 201);
  } catch (error) {
    console.error("[CREATE_JOB_ERROR]", error);
    return errorResponse("เกิดข้อผิดพลาดในการสร้างใบงาน", 500);
  }
}
