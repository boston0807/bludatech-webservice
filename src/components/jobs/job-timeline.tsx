// src/components/jobs/job-timeline.tsx
// Stepper สถานะใบงาน (พร้อมวันที่ของแต่ละขั้น) + ประวัติความคืบหน้าแบบเรียงเวลา
"use client";

import { useState } from "react";
import { CheckCircle2, Circle, ChevronDown, ChevronUp, Clock } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { thDate, thDateRange } from "@/lib/labels";
import { buildEvents, buildSteps, nextActionText, type TimelineJob, type TimelineEvent } from "@/lib/job-timeline";

const DOT: Record<TimelineEvent["tone"], string> = {
  default: "bg-primary",
  success: "bg-green-600",
  warning: "bg-amber-500",
  danger: "bg-destructive",
  scheduled: "bg-white border-2 border-primary",
};

export function JobTimeline({ job }: { job: TimelineJob }) {
  const [showAll, setShowAll] = useState(false);
  const steps = buildSteps(job);
  const events = buildEvents(job);
  const next = nextActionText(job.status);
  const visible = showAll ? events : events.slice(-4);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">สถานะใบงาน</CardTitle>
        {next && (
          <CardDescription className="flex items-center gap-1.5">
            <Clock className="h-3.5 w-3.5" /> ขั้นตอนถัดไป: {next}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Stepper */}
        <ol className="flex items-start overflow-x-auto pb-2" aria-label="ขั้นตอนของใบงาน">
          {steps.map((step, idx) => (
            <li key={step.key} className="flex items-start flex-shrink-0" aria-current={step.state === "current" ? "step" : undefined}>
              <div className="flex flex-col items-center gap-1 w-[72px]">
                {step.state === "done" ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : step.state === "current" ? (
                  <div className="h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-4 ring-primary/20">
                    <div className="h-2 w-2 rounded-full bg-white" />
                  </div>
                ) : (
                  <Circle className="h-5 w-5 text-muted-foreground/40" />
                )}
                <span
                  className={`text-[11px] text-center leading-tight ${
                    step.state === "current"
                      ? "text-primary font-semibold"
                      : step.state === "done"
                      ? "text-green-700"
                      : "text-muted-foreground/60"
                  }`}
                >
                  {step.label}
                </span>
                {step.date && (
                  <span className="text-[10px] text-muted-foreground text-center leading-tight">
                    {step.hint ? `${step.hint} ` : ""}
                    {thDate(step.date)}
                  </span>
                )}
              </div>
              {idx < steps.length - 1 && (
                <div
                  className={`h-0.5 w-3 flex-shrink-0 mt-2.5 ${
                    step.state === "done" ? "bg-green-400" : "bg-muted-foreground/20"
                  }`}
                />
              )}
            </li>
          ))}
        </ol>

        {/* Event log */}
        {events.length > 0 && (
          <div className="border-t pt-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-medium">ประวัติความคืบหน้า</p>
              {events.length > 4 && (
                <button
                  type="button"
                  onClick={() => setShowAll((v) => !v)}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1"
                >
                  {showAll ? (
                    <>
                      ย่อ <ChevronUp className="h-3 w-3" />
                    </>
                  ) : (
                    <>
                      ดูทั้งหมด ({events.length}) <ChevronDown className="h-3 w-3" />
                    </>
                  )}
                </button>
              )}
            </div>
            <ol className="relative ml-1.5 border-l border-muted-foreground/20 space-y-3">
              {visible.map((e, i) => (
                <li key={`${e.title}-${e.date}-${i}`} className="ml-4">
                  <span className={`absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full ${DOT[e.tone]}`} />
                  <p className="text-xs text-muted-foreground">
                    {e.undated ? "ล่าสุด" : e.endDate ? thDateRange(e.date, e.endDate) : thDate(e.date)}
                    {e.tone === "scheduled" && " (นัดหมาย)"}
                  </p>
                  <p className={`text-sm ${e.tone === "danger" ? "text-destructive" : e.tone === "warning" ? "text-amber-700" : ""}`}>
                    {e.title}
                  </p>
                  {e.detail && <p className="text-xs text-muted-foreground">{e.detail}</p>}
                </li>
              ))}
            </ol>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
