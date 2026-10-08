"use client";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CircleCheck, Clock, Crosshair, LoaderCircle, LogIn, LogOut, MapPin, ShieldAlert, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { checkGeofence } from "@/lib/geo/geofence";
import type { PositionSample } from "@/lib/geo/anti-spoof";
import { cn } from "@/lib/utils";

const GeoMap = dynamic(() => import("./geo-map"), {
  ssr: false,
  loading: () => <div className="flex h-64 items-center justify-center rounded-lg bg-muted text-sm text-muted-foreground md:h-80">جارٍ تحميل الخريطة...</div>,
});

interface TodayResponse {
  placement: null | {
    id: string;
    requiredHours: number;
    approvedHours: number;
    isWorkDay: boolean;
    organization: { name: string; latitude: number; longitude: number; radius: number; workStartTime: string; workEndTime: string; address: string | null };
  };
  record: null | {
    status: string;
    checkInAt: string | null;
    checkOutAt: string | null;
    workedMinutes: number;
    approvalStatus: string;
    isSuspicious: boolean;
  };
}

type Phase = "idle" | "locating" | "submitting";

const SAMPLE_TARGET = 4; // عدد القراءات المطلوبة
const SAMPLE_TIMEOUT_MS = 15_000;

/** معرّف ثابت للجهاز (يُربط بحساب الطالب عند أول تحضير) */
function getDeviceId(): string {
  const KEY = "qu-ft-device-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

/**
 * يجمع عدة قراءات GPS متتالية عالية الدقة.
 * تعدد القراءات يسمح للخادم بقياس "التذبذب الطبيعي" وكشف المواقع الثابتة المزيفة.
 */
function collectSamples(onProgress: (s: PositionSample[]) => void): Promise<PositionSample[]> {
  return new Promise((resolve, reject) => {
    if (!("geolocation" in navigator)) return reject(new Error("المتصفح لا يدعم تحديد الموقع"));
    const samples: PositionSample[] = [];
    let settled = false;
    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      navigator.geolocation.clearWatch(watchId);
      clearTimeout(timer);
      if (samples.length) resolve(samples);
      else reject(err ?? new Error("تعذر الحصول على الموقع، تأكد من تفعيل GPS"));
    };
    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        samples.push({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          altitude: pos.coords.altitude,
          speed: pos.coords.speed,
          heading: pos.coords.heading,
          timestamp: pos.timestamp,
        });
        onProgress([...samples]);
        if (samples.length >= SAMPLE_TARGET) finish();
      },
      (err) => {
        const msg =
          err.code === err.PERMISSION_DENIED
            ? "تم رفض صلاحية الموقع. فعّلها من إعدادات المتصفح ثم أعد المحاولة"
            : err.code === err.TIMEOUT
              ? "انتهت مهلة تحديد الموقع، انتقل لمكان مكشوف وأعد المحاولة"
              : "تعذر تحديد الموقع";
        finish(new Error(msg));
      },
      { enableHighAccuracy: true, maximumAge: 0, timeout: SAMPLE_TIMEOUT_MS }
    );
    const timer = setTimeout(() => finish(), SAMPLE_TIMEOUT_MS);
  });
}

function useElapsed(since: string | null | undefined, active: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const t = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(t);
  }, [active]);
  if (!since) return 0;
  return Math.max(0, Math.floor((now - new Date(since).getTime()) / 60000));
}

const fmtTime = (iso: string) => new Date(iso).toLocaleTimeString("ar-SA-u-nu-latn", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Riyadh" });
const fmtDuration = (m: number) => `${Math.floor(m / 60)} س ${m % 60} د`;

export function GpsCheckIn() {
  const [data, setData] = useState<TodayResponse | null>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [samples, setSamples] = useState<PositionSample[]>([]);
  const [message, setMessage] = useState<{ kind: "success" | "error" | "warning"; text: string; details?: string[] } | null>(null);
  const deviceId = useRef<string>("");

  const load = useCallback(async () => {
    const res = await fetch("/api/attendance/today", { cache: "no-store" });
    setData(await res.json());
  }, []);

  useEffect(() => {
    deviceId.current = getDeviceId();
    load();
  }, [load]);

  const org = data?.placement?.organization;
  const record = data?.record;
  const checkedIn = !!record?.checkInAt;
  const checkedOut = !!record?.checkOutAt;
  const elapsed = useElapsed(record?.checkInAt, checkedIn && !checkedOut);

  const latest = samples.length ? [...samples].sort((a, b) => a.accuracy - b.accuracy)[0] : null;
  const fence = useMemo(
    () => (latest && org ? checkGeofence(latest, { latitude: org.latitude, longitude: org.longitude }, org.radius, latest.accuracy) : null),
    [latest, org]
  );

  async function act(type: "check-in" | "check-out") {
    setMessage(null);
    setSamples([]);
    setPhase("locating");
    try {
      const collected = await collectSamples(setSamples);
      setPhase("submitting");
      const res = await fetch(`/api/attendance/${type}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ samples: collected, deviceId: deviceId.current }),
      });
      const json = await res.json();
      if (res.ok && json.ok) {
        setMessage({
          kind: json.flagged ? "warning" : "success",
          text:
            type === "check-in"
              ? `تم تسجيل حضورك${json.status === "LATE" ? " (متأخر)" : ""} — تبعد ${Math.round(json.distance)} م عن مركز الجهة`
              : `تم تسجيل انصرافك — مدة اليوم ${fmtDuration(json.workedMinutes ?? 0)}`,
          details: json.flagged ? ["سُجّل الحضور لكنه أحيل للمراجعة بسبب مؤشرات غير اعتيادية في الموقع"] : undefined,
        });
        await load();
      } else {
        setMessage({ kind: "error", text: json.reason ?? json.error ?? "تعذر التسجيل" });
      }
    } catch (e) {
      setMessage({ kind: "error", text: (e as Error).message });
    } finally {
      setPhase("idle");
    }
  }

  if (!data) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 p-8 text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin" /> جارٍ التحميل...
        </CardContent>
      </Card>
    );
  }

  if (!data.placement || !org) {
    return (
      <Card>
        <CardContent className="p-8 text-center text-muted-foreground">لا يوجد تدريب ميداني فعّال لك اليوم.</CardContent>
      </Card>
    );
  }

  const busy = phase !== "idle";
  const hoursPct = (data.placement.approvedHours / data.placement.requiredHours) * 100;

  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
      <Card className="overflow-hidden">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <MapPin className="size-5 text-primary" /> {org.name}
          </CardTitle>
          <CardDescription>
            الدوام {org.workStartTime} - {org.workEndTime} · نطاق التحضير {org.radius} متر{org.address ? ` · ${org.address}` : ""}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <GeoMap
            center={{ lat: org.latitude, lng: org.longitude }}
            radius={org.radius}
            orgName={org.name}
            user={latest ? { lat: latest.latitude, lng: latest.longitude, accuracy: latest.accuracy } : null}
            inside={fence?.inside}
          />
          {fence && latest && (
            <div className={cn("mt-3 flex flex-wrap items-center gap-3 rounded-lg p-3 text-sm", fence.inside ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800")}>
              <Crosshair className="size-4" />
              <span>المسافة: <b>{Math.round(fence.distance)} م</b></span>
              <span>الدقة: ±{Math.round(latest.accuracy)} م</span>
              <span>القراءات: {samples.length}/{SAMPLE_TARGET}</span>
              <Badge variant={fence.inside ? "success" : "destructive"}>{fence.inside ? "داخل النطاق" : "خارج النطاق"}</Badge>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex flex-col gap-4">
        <Card>
          <CardHeader>
            <CardTitle>تحضير اليوم</CardTitle>
            <CardDescription>
              {new Date().toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { weekday: "long", day: "numeric", month: "long", timeZone: "Asia/Riyadh" })}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-2 gap-2 text-center text-sm">
              <div className="rounded-lg bg-muted p-3">
                <div className="text-muted-foreground">الحضور</div>
                <div className="mt-1 text-lg font-bold">{record?.checkInAt ? fmtTime(record.checkInAt) : "—"}</div>
              </div>
              <div className="rounded-lg bg-muted p-3">
                <div className="text-muted-foreground">الانصراف</div>
                <div className="mt-1 text-lg font-bold">{record?.checkOutAt ? fmtTime(record.checkOutAt) : "—"}</div>
              </div>
            </div>

            {checkedIn && !checkedOut && (
              <div className="flex items-center justify-center gap-2 rounded-lg border border-dashed border-primary/40 p-2 text-sm text-primary">
                <Clock className="size-4" /> على رأس التدريب منذ {fmtDuration(elapsed)}
              </div>
            )}

            {!data.placement.isWorkDay ? (
              <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">اليوم ليس من أيام التدريب</p>
            ) : checkedOut ? (
              <div className="flex flex-col items-center gap-2 rounded-lg bg-emerald-50 p-4 text-emerald-800">
                <CircleCheck className="size-8" />
                <div className="font-semibold">اكتمل تحضير اليوم ({fmtDuration(record!.workedMinutes)})</div>
                <Badge variant={record!.approvalStatus === "APPROVED" ? "success" : record!.approvalStatus === "REJECTED" ? "destructive" : "warning"}>
                  {record!.approvalStatus === "APPROVED" ? "معتمد من المشرف" : record!.approvalStatus === "REJECTED" ? "رفضه المشرف المؤسسي" : "بانتظار اعتماد المشرف المؤسسي"}
                </Badge>
              </div>
            ) : (
              <Button
                size="lg"
                variant={checkedIn ? "teal" : "default"}
                className="h-16 w-full text-lg"
                disabled={busy}
                onClick={() => act(checkedIn ? "check-out" : "check-in")}
              >
                {busy ? <LoaderCircle className="animate-spin" /> : checkedIn ? <LogOut /> : <LogIn />}
                {phase === "locating"
                  ? `جارٍ تحديد موقعك (${samples.length}/${SAMPLE_TARGET})`
                  : phase === "submitting"
                    ? "جارٍ التحقق..."
                    : checkedIn
                      ? "تسجيل الانصراف"
                      : "تسجيل الحضور"}
              </Button>
            )}

            {message && (
              <div
                role="status"
                className={cn(
                  "flex gap-2 rounded-lg p-3 text-sm",
                  message.kind === "success" && "bg-emerald-50 text-emerald-800",
                  message.kind === "warning" && "bg-amber-50 text-amber-800",
                  message.kind === "error" && "bg-red-50 text-red-800"
                )}
              >
                {message.kind === "error" ? <TriangleAlert className="size-4 shrink-0" /> : message.kind === "warning" ? <ShieldAlert className="size-4 shrink-0" /> : <CircleCheck className="size-4 shrink-0" />}
                <div>
                  {message.text}
                  {message.details?.map((d) => <div key={d} className="mt-1 text-xs opacity-80">{d}</div>)}
                </div>
              </div>
            )}

            {record?.isSuspicious && (
              <p className="flex items-center gap-1.5 text-xs text-amber-700">
                <ShieldAlert className="size-3.5" /> سجل اليوم قيد المراجعة من وحدة التدريب
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-2 p-5">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">الساعات المعتمدة</span>
              <span className="font-semibold">{data.placement.approvedHours} / {data.placement.requiredHours}</span>
            </div>
            <Progress value={hoursPct} />
          </CardContent>
        </Card>

        <p className="text-xs leading-relaxed text-muted-foreground">
          يتحقق النظام من وجودك داخل نطاق الجهة ويجمع عدة قراءات للموقع. استخدام تطبيقات تزييف الموقع يُكتشف ويُحال للمساءلة وفق لائحة التدريب الميداني.
        </p>
      </div>
    </div>
  );
}
