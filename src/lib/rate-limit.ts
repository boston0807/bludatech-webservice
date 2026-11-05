// src/lib/rate-limit.ts
// จำกัดจำนวนครั้งที่ล้มเหลว (เช่น login ผิด) ต่อ key ภายในช่วงเวลา — เก็บใน memory ไม่ใช้ฐานข้อมูล
// หมายเหตุ: บน Cloudflare Workers memory แยกตาม isolate จึงเป็นการป้องกันแบบ best-effort
// ถ้าต้องการให้แชร์ทุก instance ให้เปลี่ยน store เป็น Cloudflare KV / Durable Object ได้โดยไม่แตะ DB

type Entry = { count: number; resetAt: number };

const store = new Map<string, Entry>();
const MAX_KEYS = 10_000;

function prune(now: number) {
  if (store.size < MAX_KEYS) return;
  for (const [k, v] of store) if (v.resetAt <= now) store.delete(k);
  // ยังเต็มอยู่ (ถูกยิงด้วย key จำนวนมาก) → ทิ้งรายการเก่าสุดครึ่งหนึ่ง
  if (store.size >= MAX_KEYS) {
    let i = 0;
    for (const k of store.keys()) {
      if (i++ > MAX_KEYS / 2) break;
      store.delete(k);
    }
  }
}

export function createRateLimiter(opts: { limit: number; windowMs: number }) {
  return {
    /** ถูกบล็อกอยู่ไหม — คืนจำนวนวินาทีที่ต้องรอ หรือ 0 ถ้าใช้งานได้ */
    blockedFor(key: string, now = Date.now()): number {
      const e = store.get(key);
      if (!e || e.resetAt <= now) return 0;
      return e.count >= opts.limit ? Math.ceil((e.resetAt - now) / 1000) : 0;
    },
    /** บันทึกความล้มเหลว 1 ครั้ง */
    hit(key: string, now = Date.now()) {
      prune(now);
      const e = store.get(key);
      if (!e || e.resetAt <= now) store.set(key, { count: 1, resetAt: now + opts.windowMs });
      else e.count += 1;
    },
    reset(key: string) {
      store.delete(key);
    },
  };
}

/** IP ของผู้เรียก (Cloudflare ใส่ cf-connecting-ip ให้) */
export function clientIp(headers: Headers): string {
  return (
    headers.get("cf-connecting-ip") ??
    headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    headers.get("x-real-ip") ??
    "unknown"
  );
}
