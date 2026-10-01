// src/app/api/jobs/route.ts
import { NextRequest } from "next/server";
import { prisma } from "@/lib/prisma";
import { verifyToken, AUTH_COOKIE_NAME } from "@/lib/auth";
import { successResponse, errorResponse, unauthorizedResponse, forbiddenResponse } from "@/lib/api-response";
import { createJobSchema } from "@/lib/validations/job";

// GET /api/jobs — ดึง jobs ตาม role
export async function GET(req: NextRequest) {
  const token = req.cookies.get(AUTH_COOKIE_NAME)?.value;
  if (!token) return unauthorizedResponse();
  const payload = await verifyToken(token);
  if (!payload) return unauthorizedResponse();

  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? undefined;

  let jobs;

  if (payload.role === "CUSTOMER") {
    // ลูกค้าเห็นเฉพาะ jobs ของตัวเอง
    jobs = await prisma.job.findMany({
      where: {
        customerId: payload.sub,
        ...(status ? { status: status as never } : {}),
      },
      include: {
        installation: true,
        repair: true,
        service: true,
      },
      orderBy: { createdAt: "desc" },
    });
  } else if (payload.role === "ADMIN") {
    jobs = await prisma.job.findMany({
      where: status ? { status: status as never } : {},
      include: { customer: { select: { customerName: true, customerPhone: true } } },
      orderBy: { createdAt: "desc" },
    });
  } else if (payload.role === "HEAD_TECHNICIAN" || payload.role === "TECHNICIAN") {
    jobs = await prisma.job.findMany({
      where: status ? { status: status as never } : {},
      include: { customer: { select: { customerName: true, customerPhone: true } }, installation: true, repair: true, service: true },
      orderBy: { createdAt: "desc" },
    });
  } else if (payload.role === "ACCOUNTANT") {
    jobs = await prisma.job.findMany({
      where: status ? { status: status as never } : {},
      include: { customer: { select: { customerName: true } } },
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

  const body = await req.json();
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
