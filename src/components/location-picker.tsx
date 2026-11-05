// src/components/location-picker.tsx
// เลือกสถานที่จากแผนที่ (OpenStreetMap + Leaflet)
// - ค้นหาสถานที่ / ใช้ตำแหน่งปัจจุบัน / คลิกหรือลากหมุดบนแผนที่
// - ระบบเติมที่อยู่ให้อัตโนมัติจากตำแหน่งหมุด ผู้ใช้ไม่ต้องพิมพ์เอง (แก้ไขเพิ่มเติมได้ เช่น เลขที่/ชั้น)
// - เก็บเฉพาะข้อความที่อยู่ (ไม่เก็บพิกัด จึงไม่ต้องแก้ database) ถ้ามีที่อยู่เดิมจะค้นหาเพื่อปักหมุดให้ 1 ครั้ง
// ค้นหาที่อยู่ผ่าน Nominatim ซึ่งห้ามเรียกถี่ (ไม่เกิน 1 ครั้ง/วินาที, ห้าม autocomplete)
// จึงค้นหาเฉพาะเมื่อกดปุ่ม/Enter และแปลงหมุดเป็นที่อยู่เฉพาะเมื่อผู้ใช้วางหมุด
"use client";

import "leaflet/dist/leaflet.css";
import { useEffect, useId, useRef, useState } from "react";
import type { Map as LeafletMap, Marker as LeafletMarker } from "leaflet";
import { Crosshair, Loader2, MapPin, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Props = {
  value: string; // ข้อความที่อยู่
  onChange: (address: string) => void;
  label?: string;
  required?: boolean;
  error?: string;
};

type SearchResult = { place_id: number; display_name: string; lat: string; lon: string };

const NOMINATIM = "https://nominatim.openstreetmap.org";
const DEFAULT_CENTER: [number, number] = [13.7563, 100.5018]; // กรุงเทพฯ
const PIN_HTML = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="36" height="36" fill="#2563eb" stroke="#ffffff" stroke-width="1.5"><path d="M12 2C8.1 2 5 5.1 5 9c0 5.2 7 13 7 13s7-7.8 7-13c0-3.9-3.1-7-7-7z"/><circle cx="12" cy="9" r="2.6" fill="#ffffff" stroke="none"/></svg>`;

// ตัด ", ประเทศไทย" ท้ายที่อยู่ออกให้อ่านง่าย
function cleanAddress(displayName: string): string {
  return displayName.replace(/,\s*(ประเทศไทย|Thailand)\s*$/i, "").trim();
}

async function geocode(q: string, limit: number): Promise<SearchResult[]> {
  const res = await fetch(
    `${NOMINATIM}/search?format=jsonv2&limit=${limit}&countrycodes=th&accept-language=th&q=${encodeURIComponent(q)}`
  );
  if (!res.ok) throw new Error(`geocode ${res.status}`);
  return res.json();
}

export function LocationPicker({ value, onChange, label = "สถานที่", required, error }: Props) {
  const inputId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<LeafletMarker | null>(null);
  const reverseAbort = useRef<AbortController | null>(null);
  // event ของ Leaflet ผูกครั้งเดียว → อ่าน callback ล่าสุดผ่าน ref
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const initialAddress = useRef(value);

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);

  // วางหมุด + เลื่อนแผนที่ไปยังตำแหน่ง
  const placeMarker = (lat: number, lng: number, zoom = 17) => {
    const map = mapRef.current;
    const marker = markerRef.current;
    if (!map || !marker) return;
    marker.setLatLng([lat, lng]);
    if (!map.hasLayer(marker)) marker.addTo(map);
    map.setView([lat, lng], zoom);
  };

  // แปลงพิกัดเป็นที่อยู่ แล้วเติมให้ฟอร์ม
  const resolveAddress = async (lat: number, lng: number) => {
    reverseAbort.current?.abort();
    const ctrl = new AbortController();
    reverseAbort.current = ctrl;
    setResolving(true);
    setNotice(null);
    try {
      const res = await fetch(
        `${NOMINATIM}/reverse?format=jsonv2&lat=${lat}&lon=${lng}&zoom=18&addressdetails=0&accept-language=th`,
        { signal: ctrl.signal }
      );
      if (!res.ok) throw new Error(`reverse ${res.status}`);
      const d = await res.json();
      if (d?.display_name) onChangeRef.current(cleanAddress(d.display_name));
      else setNotice("ไม่พบชื่อที่อยู่ของจุดนี้ กรุณาพิมพ์ที่อยู่เพิ่มเติมในช่องด้านล่าง");
    } catch (e) {
      if ((e as Error).name !== "AbortError") {
        setNotice("ดึงที่อยู่จากแผนที่ไม่สำเร็จ กรุณาพิมพ์ที่อยู่เพิ่มเติมในช่องด้านล่าง");
      }
    } finally {
      if (reverseAbort.current === ctrl) setResolving(false);
    }
  };
  const resolveRef = useRef(resolveAddress);
  resolveRef.current = resolveAddress;

  // สร้างแผนที่ครั้งเดียว (Leaflet ใช้ window จึงต้อง import ฝั่ง browser)
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const L = (await import("leaflet")).default;
      if (cancelled || !containerRef.current || mapRef.current) return;

      const map = L.map(containerRef.current, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, 11);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      }).addTo(map);

      const icon = L.divIcon({ html: PIN_HTML, className: "", iconSize: [36, 36], iconAnchor: [18, 34] });
      const marker = L.marker(DEFAULT_CENTER, { icon, draggable: true, keyboard: false });

      marker.on("dragend", () => {
        const p = marker.getLatLng();
        resolveRef.current(p.lat, p.lng);
      });
      map.on("click", (e) => {
        marker.setLatLng(e.latlng);
        if (!map.hasLayer(marker)) marker.addTo(map);
        resolveRef.current(e.latlng.lat, e.latlng.lng);
      });
      // ให้ซูมด้วย scroll ได้หลังผู้ใช้คลิกแผนที่ (กันหน้าเลื่อนแล้วแผนที่ซูมเอง)
      map.on("focus", () => map.scrollWheelZoom.enable());
      map.on("blur", () => map.scrollWheelZoom.disable());

      mapRef.current = map;
      markerRef.current = marker;

      // มีที่อยู่เดิม (แก้ไขข้อมูล/แผนงานจากใบงาน) → ค้นหา 1 ครั้งเพื่อปักหมุด โดยไม่แก้ข้อความที่อยู่
      const address = initialAddress.current.trim();
      if (address) {
        try {
          const [hit] = await geocode(address, 1);
          if (!cancelled && hit && !map.hasLayer(marker)) placeMarker(Number(hit.lat), Number(hit.lon), 16);
        } catch {
          // ปักหมุดไม่ได้ก็ไม่เป็นไร ผู้ใช้เลือกเองได้
        }
      }
    })();

    return () => {
      cancelled = true;
      reverseAbort.current?.abort();
      mapRef.current?.remove();
      mapRef.current = null;
      markerRef.current = null;
    };
  }, []);

  const search = async () => {
    const q = query.trim();
    if (!q || searching) return;
    setSearching(true);
    setNotice(null);
    setResults([]);
    try {
      const d = await geocode(q, 5);
      if (d.length === 0) setNotice("ไม่พบสถานที่ ลองพิมพ์ชื่อสถานที่ ถนน หรือเขต/อำเภอ หรือคลิกเลือกบนแผนที่แทน");
      setResults(d);
    } catch {
      setNotice("ค้นหาไม่สำเร็จ กรุณาลองใหม่ หรือคลิกเลือกบนแผนที่แทน");
    } finally {
      setSearching(false);
    }
  };

  const pickResult = (r: SearchResult) => {
    setResults([]);
    placeMarker(Number(r.lat), Number(r.lon));
    onChange(cleanAddress(r.display_name));
  };

  const useCurrentLocation = () => {
    if (!navigator.geolocation) {
      setNotice("เบราว์เซอร์นี้ไม่รองรับการระบุตำแหน่ง");
      return;
    }
    setLocating(true);
    setNotice(null);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocating(false);
        const { latitude, longitude } = pos.coords;
        placeMarker(latitude, longitude);
        resolveAddress(latitude, longitude);
      },
      () => {
        setLocating(false);
        setNotice("ไม่สามารถระบุตำแหน่งได้ กรุณาอนุญาตการเข้าถึงตำแหน่ง หรือค้นหา/คลิกเลือกบนแผนที่แทน");
      },
      { enableHighAccuracy: true, timeout: 10000 }
    );
  };

  return (
    <div className="space-y-2">
      <Label htmlFor={inputId}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>

      {/* ค้นหา — กด Enter ต้องไม่ submit ฟอร์มหลัก */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder="ค้นหาสถานที่ เช่น ชื่ออาคาร ถนน เขต"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                search();
              }
            }}
            aria-label="ค้นหาสถานที่"
          />
        </div>
        <Button type="button" variant="outline" onClick={search} disabled={searching || !query.trim()}>
          {searching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />}
          ค้นหา
        </Button>
        <Button
          type="button"
          variant="outline"
          size="icon"
          onClick={useCurrentLocation}
          disabled={locating}
          aria-label="ใช้ตำแหน่งปัจจุบัน"
          title="ใช้ตำแหน่งปัจจุบัน"
        >
          {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Crosshair className="h-4 w-4" />}
        </Button>
      </div>

      {results.length > 0 && (
        <ul className="rounded-md border bg-background text-sm shadow-sm divide-y">
          {results.map((r) => (
            <li key={r.place_id}>
              <button
                type="button"
                onClick={() => pickResult(r)}
                className="flex w-full items-start gap-2 px-3 py-2 text-left hover:bg-accent focus-visible:bg-accent focus-visible:outline-none"
              >
                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <span>{cleanAddress(r.display_name)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {/* isolate: กัน z-index ของ Leaflet ทับเมนู/ส่วนอื่นของหน้า */}
      <div className="relative isolate overflow-hidden rounded-md border">
        <div ref={containerRef} className="h-64 w-full sm:h-72" />
        {resolving && (
          <div className="absolute right-2 top-2 z-[1000] flex items-center gap-1.5 rounded-md bg-background/90 px-2 py-1 text-xs shadow">
            <Loader2 className="h-3 w-3 animate-spin" /> กำลังดึงที่อยู่…
          </div>
        )}
      </div>
      <p className="text-xs text-muted-foreground">
        คลิกบนแผนที่หรือลากหมุดเพื่อเลือกตำแหน่ง ระบบจะเติมที่อยู่ให้อัตโนมัติ
      </p>

      {notice && <p className="text-xs text-amber-700">{notice}</p>}

      <textarea
        id={inputId}
        rows={2}
        className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        placeholder="ที่อยู่จะแสดงที่นี่หลังเลือกตำแหน่ง (เพิ่มเลขที่ ชั้น หรือจุดสังเกตได้)"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {error && <p className="text-destructive text-xs">{error}</p>}
    </div>
  );
}
