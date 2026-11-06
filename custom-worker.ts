// custom-worker.ts
// ห่อ worker ที่ OpenNext สร้างให้ เพื่อเพิ่ม handler "scheduled" สำหรับ Cloudflare Cron Trigger
// (ตั้งเวลาไว้ใน wrangler.jsonc → triggers.crons)
// ดู https://opennext.js.org/cloudflare/howtos/custom-worker

// @ts-ignore `.open-next/worker.js` ถูกสร้างตอน build (opennextjs-cloudflare build)
import { default as handler } from "./.open-next/worker.js";

type Env = { CRON_SECRET?: string; NEXT_PUBLIC_APP_URL?: string } & Record<string, unknown>;
type Ctx = { waitUntil(promise: Promise<unknown>): void };

export default {
  fetch: handler.fetch,

  async scheduled(_event: unknown, env: Env, ctx: Ctx) {
    if (!env.CRON_SECRET) {
      console.warn("[CRON] CRON_SECRET not set — skipping service reminders");
      return;
    }
    // เรียก API route ของแอปเองผ่าน handler โดยตรง (ไม่ออกอินเทอร์เน็ต)
    const base = env.NEXT_PUBLIC_APP_URL || "https://localhost";
    const req = new Request(`${base}/api/cron/service-reminders`, {
      method: "POST",
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(
      Promise.resolve(handler.fetch(req, env, ctx))
        .then(async (res: Response) => console.log("[CRON] service-reminders", res.status, await res.text()))
        .catch((err: unknown) => console.error("[CRON] service-reminders failed", err))
    );
  },
};
