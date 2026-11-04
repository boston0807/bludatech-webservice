// src/lib/prisma.ts
//
// Cloudflare Workers ไม่อนุญาต eval / new Function และห้ามใช้ I/O object
// (เช่น DB connection) ข้าม request จึงต้อง:
//   1) ใช้ Prisma ผ่าน driver adapter (@prisma/adapter-pg)
//   2) สร้าง PrismaClient ใหม่ "ต่อ 1 request" เมื่อรันบน Workers
// ส่วนตอน `next dev` (Node.js) ใช้ client ตัวเดียวแบบ global เหมือนเดิม
//
// ไฟล์อื่นยัง `import { prisma } from "@/lib/prisma"` ได้เหมือนเดิม
// เพราะ `prisma` ด้านล่างเป็น Proxy ที่ชี้ไปยัง client ของ request ปัจจุบัน

import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import { Pool } from "pg";

function createClient(isWorker: boolean): PrismaClient {
  const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    // บน Workers ให้ใช้ connection ครั้งเดียวแล้วปิด ไม่ให้ค้างข้าม request
    ...(isWorker ? { maxUses: 1 } : {}),
  });
  const adapter = new PrismaPg(pool);

  return new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === "development" ? ["query", "error", "warn"] : ["error"],
  });
}

// 1 client ต่อ 1 request (key = ExecutionContext ของ request นั้น)
const perRequestClients = new WeakMap<object, PrismaClient>();

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function getRequestKey(): object | undefined {
  try {
    return getCloudflareContext().ctx as unknown as object;
  } catch {
    // ไม่ได้รันบน Workers (เช่น next dev, seed script)
    return undefined;
  }
}

export function getDb(): PrismaClient {
  const key = getRequestKey();

  if (key) {
    let client = perRequestClients.get(key);
    if (!client) {
      client = createClient(true);
      perRequestClients.set(key, client);
    }
    return client;
  }

  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = createClient(false);
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_target, prop) {
    const db = getDb();
    const value = Reflect.get(db, prop, db);
    return typeof value === "function" ? value.bind(db) : value;
  },
});
