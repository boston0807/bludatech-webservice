// custom-worker.ts
// Entry point ของ Cloudflare Worker: ห่อ worker ที่ OpenNext build ให้ แล้วเพิ่ม scheduled() สำหรับ Cron Trigger
// ตาราง Cron ตั้งไว้ใน wrangler.jsonc → triggers.crons
// ดู https://opennext.js.org/cloudflare/howtos/custom-worker

// @ts-ignore — ไฟล์นี้ถูกสร้างตอน `opennextjs-cloudflare build`
import { default as handler } from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string; NEXT_PUBLIC_APP_URL?: string; [key: string]: unknown };
type Ctx = { waitUntil(promise: Promise<unknown>): void };
type ScheduledEvent = { cron: string; scheduledTime: number };

// cron expression → API route ที่ต้องเรียก (เพิ่มงานตั้งเวลาอื่นได้ที่นี่)
const CRON_ROUTES: Record<string, string> = {
  "0 0 * * *": "/api/cron/service-rounds", // ทุกวัน 07:00 น. เวลาไทย
};

async function runCron(path: string, env: Env, ctx: Ctx) {
  if (!env.CRON_SECRET) {
    console.error(`[CRON] CRON_SECRET is not set — skip ${path}`);
    return;
  }
  const origin = env.NEXT_PUBLIC_APP_URL || "https://localhost";
  const req = new Request(new URL(path, origin), {
    method: "POST",
    headers: { authorization: `Bearer ${env.CRON_SECRET}` },
  });
  // เรียก Next.js handler ตรง ๆ ภายใน worker เดียวกัน (ไม่ออกไปทาง internet)
  const res: Response = await handler.fetch(req, env, ctx);
  console.log(`[CRON] ${path} → ${res.status} ${await res.text()}`);
}

export default {
  fetch: handler.fetch,

  async scheduled(event: ScheduledEvent, env: Env, ctx: Ctx) {
    const path = CRON_ROUTES[event.cron];
    if (!path) {
      console.warn(`[CRON] no route for "${event.cron}"`);
      return;
    }
    ctx.waitUntil(runCron(path, env, ctx));
  },
};

// Durable Objects ที่ OpenNext ใช้ (ต้อง re-export จาก entry point)
// @ts-ignore
export { DOQueueHandler, DOShardedTagCache, BucketCachePurge } from "./.open-next/worker.js";
