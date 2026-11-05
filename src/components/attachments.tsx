// src/components/attachments.tsx
// UI ไฟล์แนบของใบงาน
//   <AttachmentUploader> — แนบไฟล์ไว้ก่อน แล้วส่ง id ไปพร้อมฟอร์ม (สำรวจ / ทดสอบความปลอดภัย / ชำระเงิน)
//   <AttachmentGallery>  — แสดงรูปทั้งหมดของใบงาน และ (ถ้าอนุญาต) อัปโหลดเพิ่มได้ทันที เช่น รูปก่อน/หลังทำงาน
"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, FileText, ImageIcon, Loader2, Trash2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ATTACHMENT_LABEL,
  attachmentUrl,
  deleteAttachment,
  uploadAttachment,
  type AttachmentCategory,
  type AttachmentInfo,
} from "@/lib/upload-client";

// ─── รูปย่อ 1 ไฟล์ ────────────────────────────────────────────

export function AttachmentThumb({
  attachment,
  onDelete,
  deleting,
  size = "md",
}: {
  attachment: Pick<AttachmentInfo, "id" | "fileName" | "mimeType">;
  onDelete?: () => void;
  deleting?: boolean;
  size?: "sm" | "md";
}) {
  const dim = size === "sm" ? "h-16 w-16" : "h-24 w-24";
  const isPdf = attachment.mimeType === "application/pdf";
  return (
    <div className={`relative ${dim} shrink-0 overflow-hidden rounded-md border bg-muted group`}>
      <a href={attachmentUrl(attachment.id)} target="_blank" rel="noreferrer" title={attachment.fileName} className="block h-full w-full">
        {isPdf ? (
          <span className="flex h-full w-full flex-col items-center justify-center gap-1 text-xs text-muted-foreground">
            <FileText className="h-6 w-6" /> PDF
          </span>
        ) : (
          // eslint-disable-next-line @next/next/no-img-element -- ไฟล์ส่วนตัวผ่าน signed URL ไม่เหมาะกับ next/image
          <img src={attachmentUrl(attachment.id)} alt={attachment.fileName} loading="lazy" className="h-full w-full object-cover" />
        )}
      </a>
      {onDelete && (
        <button
          type="button"
          onClick={onDelete}
          disabled={deleting}
          aria-label={`ลบ ${attachment.fileName}`}
          className="absolute right-1 top-1 rounded bg-black/60 p-1 text-white opacity-90 hover:bg-black/80"
        >
          {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  );
}

// ─── ปุ่มเลือกไฟล์ (ใช้ร่วม) ───────────────────────────────────

function useUploader(jobId: string, category: AttachmentCategory, onUploaded: (a: AttachmentInfo) => void) {
  const [uploading, setUploading] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const upload = async (files: FileList | null) => {
    if (!files?.length) return;
    setError(null);
    const list = Array.from(files);
    setUploading((n) => n + list.length);
    for (const file of list) {
      try {
        onUploaded(await uploadAttachment(jobId, category, file));
      } catch (e) {
        setError(`${file.name}: ${(e as Error).message}`);
      } finally {
        setUploading((n) => n - 1);
      }
    }
  };
  return { upload, uploading, error, setError };
}

function PickButton({
  accept,
  multiple,
  disabled,
  uploading,
  onPick,
  label,
}: {
  accept: string;
  multiple: boolean;
  disabled?: boolean;
  uploading: number;
  onPick: (files: FileList | null) => void;
  label: string;
}) {
  const ref = useRef<HTMLInputElement>(null);
  const isPhoto = !accept.includes("pdf");
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept={accept}
        multiple={multiple}
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = ""; // เลือกไฟล์เดิมซ้ำได้
        }}
      />
      <Button type="button" size="sm" variant="outline" disabled={disabled || uploading > 0} onClick={() => ref.current?.click()} className="gap-1.5">
        {uploading > 0 ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : isPhoto ? (
          <Camera className="h-4 w-4" />
        ) : (
          <Upload className="h-4 w-4" />
        )}
        {uploading > 0 ? `กำลังอัปโหลด ${uploading} ไฟล์...` : label}
      </Button>
    </>
  );
}

const PHOTO_ACCEPT = "image/jpeg,image/png,image/webp,image/*";
const SLIP_ACCEPT = "image/jpeg,image/png,image/webp,application/pdf";

// ─── แนบไฟล์ก่อนกดบันทึกฟอร์ม ─────────────────────────────────

export function AttachmentUploader({
  jobId,
  category,
  value,
  onChange,
  max = 10,
  disabled,
  label,
}: {
  jobId: string;
  category: AttachmentCategory;
  value: AttachmentInfo[];
  onChange: (next: AttachmentInfo[]) => void;
  max?: number;
  disabled?: boolean;
  label?: string;
}) {
  // ref กันค่า value เก่าเมื่ออัปโหลดหลายไฟล์ต่อเนื่อง
  const latest = useRef(value);
  latest.current = value;
  const { upload, uploading, error, setError } = useUploader(jobId, category, (a) => {
    latest.current = [...latest.current, a];
    onChange(latest.current);
  });
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remove = async (id: string) => {
    setDeletingId(id);
    try {
      await deleteAttachment(id);
      onChange(latest.current.filter((a) => a.id !== id));
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  const full = value.length >= max;
  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <PickButton
          accept={category === "PAYMENT_SLIP" ? SLIP_ACCEPT : PHOTO_ACCEPT}
          multiple={max > 1}
          disabled={disabled || full}
          uploading={uploading}
          onPick={upload}
          label={label ?? `แนบ${ATTACHMENT_LABEL[category]}`}
        />
        <span className="text-xs text-muted-foreground">
          {value.length}/{max} ไฟล์ · ไม่เกิน 10 MB ต่อไฟล์
        </span>
      </div>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((a) => (
            <AttachmentThumb key={a.id} attachment={a} onDelete={() => remove(a.id)} deleting={deletingId === a.id} size="sm" />
          ))}
        </div>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

// ─── แกลเลอรีรูปของใบงาน ───────────────────────────────────────

export function AttachmentGallery({
  jobId,
  categories,
  uploadable = [],
  emptyText = "ยังไม่มีรูปถ่าย",
  refreshKey,
}: {
  jobId: string;
  categories: AttachmentCategory[];
  /** หมวดที่ผู้ใช้อัปโหลด/ลบได้จากแกลเลอรีนี้ (ฝั่ง server ตรวจสิทธิ์ซ้ำ) */
  uploadable?: AttachmentCategory[];
  emptyText?: string;
  refreshKey?: unknown;
}) {
  const [items, setItems] = useState<AttachmentInfo[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const load = useCallback(() => {
    fetch(`/api/jobs/${jobId}/attachments`)
      .then((r) => r.json())
      .then((d) => {
        if (d.success) setItems(d.data);
        else setLoadError(d.message ?? "โหลดรูปไม่สำเร็จ");
      })
      .catch(() => setLoadError("โหลดรูปไม่สำเร็จ"));
  }, [jobId]);

  useEffect(() => {
    load();
  }, [load, refreshKey]);

  if (loadError) return <p className="text-xs text-destructive">{loadError}</p>;
  if (!items) {
    return (
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> กำลังโหลดรูป...
      </div>
    );
  }

  const shown = items.filter((a) => categories.includes(a.category));
  if (shown.length === 0 && uploadable.length === 0) {
    return (
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <ImageIcon className="h-3.5 w-3.5" /> {emptyText}
      </p>
    );
  }

  return (
    <div className="space-y-3">
      {categories.map((cat) => {
        const group = shown.filter((a) => a.category === cat);
        const canUpload = uploadable.includes(cat);
        if (group.length === 0 && !canUpload) return null;
        return (
          <GallerySection
            key={cat}
            jobId={jobId}
            category={cat}
            items={group}
            canUpload={canUpload}
            onAdded={(a) => setItems((prev) => [...(prev ?? []), a])}
            onRemoved={(id) => setItems((prev) => (prev ?? []).filter((a) => a.id !== id))}
          />
        );
      })}
    </div>
  );
}

function GallerySection({
  jobId,
  category,
  items,
  canUpload,
  onAdded,
  onRemoved,
}: {
  jobId: string;
  category: AttachmentCategory;
  items: AttachmentInfo[];
  canUpload: boolean;
  onAdded: (a: AttachmentInfo) => void;
  onRemoved: (id: string) => void;
}) {
  const { upload, uploading, error, setError } = useUploader(jobId, category, onAdded);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const remove = async (id: string) => {
    if (!confirm("ลบรูปนี้?")) return;
    setDeletingId(id);
    try {
      await deleteAttachment(id);
      onRemoved(id);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-xs font-medium">
          {ATTACHMENT_LABEL[category]} <span className="text-muted-foreground font-normal">({items.length})</span>
        </p>
        {canUpload && (
          <PickButton accept={PHOTO_ACCEPT} multiple uploading={uploading} onPick={upload} label="เพิ่มรูป" />
        )}
      </div>
      {items.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {items.map((a) => (
            <AttachmentThumb
              key={a.id}
              attachment={a}
              onDelete={canUpload && !a.surveyId && !a.safetyCheckId && !a.paymentId ? () => remove(a.id) : undefined}
              deleting={deletingId === a.id}
            />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">ยังไม่มีรูป</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
