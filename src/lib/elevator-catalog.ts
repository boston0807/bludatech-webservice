// src/lib/elevator-catalog.ts
// ข้อมูลหลักลิฟต์ (ประเภท/รุ่น) เก็บในตาราง materials โดยไม่ต้องแก้ database
// - materialName = คำนำหน้าเฉพาะ + JSON ของข้อมูล, price = 0, stockQuantity = 0
// - เป็นรายชื่อให้เลือกเท่านั้น ไม่ใช่สินค้าในคลัง → ทุกที่ที่อ่านวัสดุต้องกรองแถวเหล่านี้ออกด้วย NOT_ELEVATOR
// - รุ่นลิฟต์อ้างถึงประเภทด้วย id ของแถวประเภท
import type { Prisma } from "@prisma/client";

const RESERVED_PREFIX = "@elevator-";
export const TYPE_PREFIX = "@elevator-type ";
export const MODEL_PREFIX = "@elevator-model ";

export type ElevatorTypeData = { name: string; description: string | null };
export type ElevatorModelData = { brand: string; name: string; typeId: string; description: string | null };

// เงื่อนไข Prisma สำหรับวัสดุจริง (ไม่รวมแถวข้อมูลลิฟต์)
export const NOT_ELEVATOR: Prisma.MaterialWhereInput = {
  NOT: { materialName: { startsWith: RESERVED_PREFIX } },
};
export const IS_ELEVATOR_TYPE: Prisma.MaterialWhereInput = { materialName: { startsWith: TYPE_PREFIX } };
export const IS_ELEVATOR_MODEL: Prisma.MaterialWhereInput = { materialName: { startsWith: MODEL_PREFIX } };

// กันไม่ให้ตั้งชื่อวัสดุจริงชนกับคำนำหน้าที่สงวนไว้
export function isReservedMaterialName(name: string): boolean {
  return name.trim().startsWith(RESERVED_PREFIX);
}

export function encodeType(data: ElevatorTypeData): string {
  return TYPE_PREFIX + JSON.stringify(data);
}

export function encodeModel(data: ElevatorModelData): string {
  return MODEL_PREFIX + JSON.stringify(data);
}

function decode<T>(materialName: string, prefix: string): T | null {
  if (!materialName.startsWith(prefix)) return null;
  try {
    return JSON.parse(materialName.slice(prefix.length)) as T;
  } catch {
    return null;
  }
}

export function decodeType(row: { id: string; materialName: string }) {
  const d = decode<ElevatorTypeData>(row.materialName, TYPE_PREFIX);
  return d ? { id: row.id, name: d.name, description: d.description ?? null } : null;
}

export function decodeModel(row: { id: string; materialName: string }) {
  const d = decode<ElevatorModelData>(row.materialName, MODEL_PREFIX);
  return d
    ? { id: row.id, brand: d.brand, name: d.name, typeId: d.typeId, description: d.description ?? null }
    : null;
}

type Db = Pick<Prisma.TransactionClient, "material">;

export async function listTypes(db: Db) {
  const rows = await db.material.findMany({ where: IS_ELEVATOR_TYPE, select: { id: true, materialName: true } });
  return rows
    .map(decodeType)
    .filter((t): t is NonNullable<typeof t> => !!t)
    .sort((a, b) => a.name.localeCompare(b.name, "th"));
}

export async function listModels(db: Db) {
  const rows = await db.material.findMany({ where: IS_ELEVATOR_MODEL, select: { id: true, materialName: true } });
  return rows
    .map(decodeModel)
    .filter((m): m is NonNullable<typeof m> => !!m)
    .sort((a, b) => a.brand.localeCompare(b.brand, "th") || a.name.localeCompare(b.name, "th"));
}

const norm = (s: string) => s.trim().toLocaleLowerCase("th");

// ชื่อซ้ำ (ไม่สนตัวพิมพ์เล็ก/ใหญ่) — ฐานข้อมูลบังคับ unique ไม่ได้เพราะไม่มีคอลัมน์แยก
export function typeNameTaken(types: { id: string; name: string }[], name: string, exceptId?: string) {
  return types.some((t) => t.id !== exceptId && norm(t.name) === norm(name));
}

export function modelTaken(
  models: { id: string; brand: string; name: string }[],
  brand: string,
  name: string,
  exceptId?: string
) {
  return models.some((m) => m.id !== exceptId && norm(m.brand) === norm(brand) && norm(m.name) === norm(name));
}
