// src/components/layout/notification-bell.tsx
// กระดิ่งแจ้งเตือนบน top-nav — ดึงข้อมูลทุก 60 วินาที (หยุดเมื่อแท็บไม่ได้เปิดอยู่) และเมื่อกลับมาที่แท็บ
"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import * as DropdownMenu from "@radix-ui/react-dropdown-menu";
import { Bell, CheckCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { thDateTime } from "@/lib/labels";

type Item = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  readAt: string | null;
  createdAt: string;
};

const POLL_MS = 60_000;

function timeAgo(iso: string): string {
  const mins = Math.floor((Date.now() - new Date(iso).getTime()) / 60_000);
  if (mins < 1) return "เมื่อสักครู่";
  if (mins < 60) return `${mins} นาทีที่แล้ว`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} ชั่วโมงที่แล้ว`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days} วันที่แล้ว`;
  return thDateTime(iso);
}

export function NotificationBell() {
  const router = useRouter();
  const [items, setItems] = useState<Item[]>([]);
  const [unread, setUnread] = useState(0);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/notifications", { cache: "no-store" });
      if (!res.ok) return;
      const d = await res.json();
      if (d.success) {
        setItems(d.data.items);
        setUnread(d.data.unreadCount);
      }
    } catch {
      // เครือข่ายหลุดชั่วคราว — รอบถัดไปค่อยลองใหม่
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(() => {
      if (document.visibilityState === "visible") load();
    }, POLL_MS);
    const onVisible = () => document.visibilityState === "visible" && load();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [load]);

  const markRead = async (body: { ids: string[] } | { all: true }) => {
    const now = new Date().toISOString();
    // อัปเดตหน้าจอทันที ไม่ต้องรอ server
    setItems((prev) =>
      prev.map((n) => (!n.readAt && ("all" in body || body.ids.includes(n.id)) ? { ...n, readAt: now } : n))
    );
    setUnread((u) => ("all" in body ? 0 : Math.max(0, u - body.ids.length)));
    await fetch("/api/notifications", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }).catch(() => {});
  };

  const open = (n: Item) => {
    if (!n.readAt) markRead({ ids: [n.id] });
    if (n.link) router.push(n.link);
  };

  return (
    <DropdownMenu.Root onOpenChange={(o) => o && load()}>
      <DropdownMenu.Trigger asChild>
        <Button
          variant="ghost"
          size="sm"
          className="relative text-muted-foreground"
          aria-label={unread > 0 ? `การแจ้งเตือน ${unread} รายการที่ยังไม่อ่าน` : "การแจ้งเตือน"}
        >
          <Bell className="h-5 w-5" />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] font-semibold leading-none text-white">
              {unread > 99 ? "99+" : unread}
            </span>
          )}
        </Button>
      </DropdownMenu.Trigger>

      <DropdownMenu.Portal>
        <DropdownMenu.Content
          align="end"
          sideOffset={8}
          className="z-50 w-[22rem] max-w-[calc(100vw-1rem)] overflow-hidden rounded-md border bg-white shadow-lg"
        >
          <div className="flex items-center justify-between border-b px-3 py-2">
            <span className="text-sm font-semibold">การแจ้งเตือน</span>
            {unread > 0 && (
              <button
                type="button"
                onClick={() => markRead({ all: true })}
                className="flex items-center gap-1 text-xs text-primary hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" /> อ่านทั้งหมดแล้ว
              </button>
            )}
          </div>

          <div className="max-h-[26rem] overflow-y-auto">
            {!loaded ? (
              <div className="flex justify-center py-8">
                <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
              </div>
            ) : items.length === 0 ? (
              <p className="px-3 py-8 text-center text-sm text-muted-foreground">ยังไม่มีการแจ้งเตือน</p>
            ) : (
              items.map((n) => (
                <DropdownMenu.Item
                  key={n.id}
                  onSelect={() => open(n)}
                  className={`flex cursor-pointer gap-2 border-b px-3 py-2.5 text-left outline-none last:border-0 hover:bg-muted/60 focus:bg-muted/60 ${
                    n.readAt ? "" : "bg-primary/5"
                  }`}
                >
                  <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.readAt ? "bg-transparent" : "bg-primary"}`} />
                  <span className="min-w-0 flex-1">
                    <span className={`block text-sm ${n.readAt ? "" : "font-semibold"}`}>{n.title}</span>
                    {n.body && <span className="block text-xs text-muted-foreground line-clamp-2">{n.body}</span>}
                    <span className="mt-0.5 block text-[11px] text-muted-foreground">{timeAgo(n.createdAt)}</span>
                  </span>
                </DropdownMenu.Item>
              ))
            )}
          </div>
        </DropdownMenu.Content>
      </DropdownMenu.Portal>
    </DropdownMenu.Root>
  );
}
