"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { Sparkles, Loader2, Download, Calendar, FileText, X } from "lucide-react";
import { supabase } from "../lib/supabase";

const DAYS = [
  { id: "lunes", label: "Lun", full: "Lunes", ics: "MO", jsDay: 1 },
  { id: "martes", label: "Mar", full: "Martes", ics: "TU", jsDay: 2 },
  { id: "miercoles", label: "Mié", full: "Miércoles", ics: "WE", jsDay: 3 },
  { id: "jueves", label: "Jue", full: "Jueves", ics: "TH", jsDay: 4 },
  { id: "viernes", label: "Vie", full: "Viernes", ics: "FR", jsDay: 5 },
  { id: "sabado", label: "Sáb", full: "Sábado", ics: "SA", jsDay: 6 },
  { id: "domingo", label: "Dom", full: "Domingo", ics: "SU", jsDay: 0 },
];

const HOURS = Array.from({ length: 18 }, (_, i) => i + 6);

const PALETTE = [
  { bg: "rgba(255,107,107,0.30)", border: "rgba(255,107,107,0.65)" },
  { bg: "rgba(78,205,196,0.30)", border: "rgba(78,205,196,0.65)" },
  { bg: "rgba(167,139,250,0.30)", border: "rgba(167,139,250,0.65)" },
  { bg: "rgba(251,191,36,0.30)", border: "rgba(251,191,36,0.65)" },
  { bg: "rgba(96,165,250,0.30)", border: "rgba(96,165,250,0.65)" },
  { bg: "rgba(244,114,182,0.30)", border: "rgba(244,114,182,0.65)" },
  { bg: "rgba(52,211,153,0.30)", border: "rgba(52,211,153,0.65)" },
  { bg: "rgba(251,146,60,0.30)", border: "rgba(251,146,60,0.65)" },
];

function colorForActivity(name) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  return PALETTE[hash % PALETTE.length];
}

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function timeToMinutes(t) {
  if (!t || !t.includes(":")) return null;
  const [h, m] = t.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return h * 60 + m;
}

function getDeviceId() {
  if (typeof window === "undefined") return null;
  let id = localStorage.getItem("mihorario_device_id");
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem("mihorario_device_id", id);
  }
  return id;
}

function expandEntries(rawEntries) {
  const out = [];
  for (const e of rawEntries || []) {
    if (!e.start || !e.end || !e.activity) continue;
    if (e.day === "todos") {
      for (const d of DAYS) out.push({ id: uid(), day: d.id, start: e.start, end: e.end, activity: e.activity });
    } else {
      const match = DAYS.find((d) => d.id === e.day);
      if (match) out.push({ id: uid(), day: match.id, start: e.start, end: e.end, activity: e.activity });
    }
  }
  return out;
}

function nextDateForDay(jsDay) {
  const today = new Date();
  const diff = (jsDay - today.getDay() + 7) % 7;
  const d = new Date(today);
  d.setDate(today.getDate() + diff);
  return d;
}

function pad(n) {
  return String(n).padStart(2, "0");
}

function icsDate(date, hhmm) {
  const [h, m] = hhmm.split(":").map(Number);
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}T${pad(h)}${pad(m)}00`;
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function buildIcs(entries) {
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//MiHorario//ES", "CALSCALE:GREGORIAN"];
  entries.forEach((e) => {
    const dayInfo = DAYS.find((d) => d.id === e.day);
    if (!dayInfo) return;
    const date = nextDateForDay(dayInfo.jsDay);
    lines.push(
      "BEGIN:VEVENT",
      `UID:${e.id}@mihorario`,
      `DTSTART:${icsDate(date, e.start)}`,
      `DTEND:${icsDate(date, e.end)}`,
      `RRULE:FREQ=WEEKLY;BYDAY=${dayInfo.ics}`,
      `SUMMARY:${e.activity}`,
      "END:VEVENT"
    );
  });
  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}

function buildTxt(entries) {
  const lines = ["MI HORARIO SEMANAL", ""];
  DAYS.forEach((d) => {
    const dayEntries = entries
      .filter((e) => e.day === d.id)
      .sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    if (dayEntries.length === 0) return;
    lines.push(d.full.toUpperCase());
    dayEntries.forEach((e) => lines.push(`  ${e.start} - ${e.end}  ${e.activity}`));
    lines.push("");
  });
  return lines.join("\n");
}

export default function Home() {
  const [deviceId, setDeviceId] = useState(null);
  const [entries, setEntries] = useState([]);
  const [chat, setChat] = useState([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [storageError, setStorageError] = useState(false);
  const [showDownload, setShowDownload] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    const id = getDeviceId();
    setDeviceId(id);
    (async () => {
      try {
        const { data, error } = await supabase
          .from("schedules")
          .select("data")
          .eq("id", id)
          .maybeSingle();
        if (!error && data?.data) {
          setEntries(Array.isArray(data.data.entries) ? data.data.entries : []);
          setChat(Array.isArray(data.data.chat) ? data.data.chat : []);
        }
      } catch (e) {
        // first run, or Supabase not reachable — start fresh
      } finally {
        setLoaded(true);
      }
    })();
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chat, sending]);

  const persist = useCallback(
    async (nextEntries, nextChat) => {
      if (!deviceId) return;
      setSaving(true);
      try {
        const { error } = await supabase
          .from("schedules")
          .upsert({ id: deviceId, data: { entries: nextEntries, chat: nextChat }, updated_at: new Date().toISOString() });
        setStorageError(!!error);
      } catch (e) {
        setStorageError(true);
      } finally {
        setSaving(false);
      }
    },
    [deviceId]
  );

  async function sendMessage() {
    if (!input.trim() || sending) return;
    const message = input.trim();
    setInput("");
    setError(null);

    const userMsg = { id: uid(), role: "user", text: message };
    const nextChat = [...chat, userMsg];
    setChat(nextChat);
    setSending(true);

    try {
      const res = await fetch("/api/schedule", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentEntries: entries, message }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "error");

      const added = expandEntries(data.new_entries);
      const nextEntries = [...entries, ...added];
      const assistantMsg = { id: uid(), role: "assistant", text: data.reply || "Listo, lo agregué." };
      const finalChat = [...nextChat, assistantMsg];

      setEntries(nextEntries);
      setChat(finalChat);
      persist(nextEntries, finalChat);
    } catch (e) {
      setError("No se pudo procesar ese mensaje. Intenta de nuevo.");
    } finally {
      setSending(false);
    }
  }

  function deleteEntry(id) {
    const nextEntries = entries.filter((e) => e.id !== id);
    setEntries(nextEntries);
    persist(nextEntries, chat);
  }

  function entryAtHour(day, hour) {
    return entries.find((e) => {
      if (e.day !== day) return false;
      const startM = timeToMinutes(e.start);
      const endM = timeToMinutes(e.end);
      const hourM = hour * 60;
      return startM !== null && endM !== null && startM <= hourM && hourM < endM;
    });
  }

  return (
    <div
      className="w-full min-h-screen"
      style={{
        backgroundColor: "#181425",
        backgroundImage: `
          radial-gradient(ellipse 650px 450px at 5% 0%, rgba(167,139,250,0.35), transparent 55%),
          radial-gradient(ellipse 550px 500px at 100% 5%, rgba(78,205,196,0.32), transparent 55%),
          radial-gradient(ellipse 600px 550px at 100% 100%, rgba(255,107,107,0.30), transparent 55%),
          radial-gradient(ellipse 550px 450px at 0% 95%, rgba(251,191,36,0.22), transparent 55%),
          radial-gradient(ellipse 450px 400px at 50% 45%, rgba(96,165,250,0.14), transparent 60%)
        `,
        fontFamily: "'IBM Plex Sans', sans-serif",
      }}
    >
      <div className="max-w-4xl mx-auto px-5 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-display text-2xl" style={{ color: "#F1EEFC" }}>
              Mi Horario
            </h1>
            <p className="font-mono text-xs mt-1" style={{ color: "#9B93B8" }}>
              dile a la IA tus actividades y ella arma el horario
            </p>
          </div>
          <div className="text-right">
            {saving && <span className="font-mono text-[10px]" style={{ color: "#9B93B8" }}>guardando…</span>}
            {!saving && loaded && !storageError && (
              <span className="font-mono text-[10px]" style={{ color: "#4ECDC4" }}>✓ guardado</span>
            )}
            {storageError && <span className="font-mono text-[10px]" style={{ color: "#FF6B6B" }}>no se pudo guardar</span>}
          </div>
        </div>

        <div className="rounded-lg p-4 mb-6" style={{ background: "#211C33", border: "1px solid #3A3355", boxShadow: "0 4px 16px rgba(0,0,0,0.3)" }}>
          <div className="space-y-3 mb-3 max-h-64 overflow-y-auto scrollbar-thin pr-1">
            {chat.length === 0 && (
              <p className="font-mono text-xs" style={{ color: "#9B93B8" }}>
                Ej: "de 7 a 8 ejercicio, de 9 a 6 trabajo entre semana" o "los domingos de 10 a 12 voy al mercado".
              </p>
            )}
            {chat.map((m) => (
              <div key={m.id} style={{ display: "flex", justifyContent: m.role === "user" ? "flex-end" : "flex-start" }}>
                <div
                  className="rounded-lg px-3 py-2 text-sm max-w-[85%]"
                  style={{ background: m.role === "user" ? "#A78BFA" : "#2E2748", color: m.role === "user" ? "#181425" : "#F1EEFC" }}
                >
                  {m.text}
                </div>
              </div>
            ))}
            {sending && (
              <div className="flex items-center gap-2 font-mono text-xs" style={{ color: "#9B93B8" }}>
                <Loader2 size={12} className="animate-spin" /> acomodando tu horario…
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {error && <p className="font-mono text-xs mb-2" style={{ color: "#FF6B6B" }}>{error}</p>}

          <div className="flex items-end gap-2">
            <textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  sendMessage();
                }
              }}
              placeholder="Escribe tus actividades y horarios…"
              rows={2}
              className="flex-1 rounded px-3 py-2 text-sm resize-none"
              style={{ background: "#181425", border: "1px solid #3A3355", color: "#F1EEFC" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || sending}
              className="px-4 py-2.5 rounded text-sm font-medium disabled:opacity-40 shrink-0 flex items-center gap-1.5"
              style={{ background: "#A78BFA", color: "#181425" }}
            >
              <Sparkles size={14} /> Enviar
            </button>
          </div>
        </div>

        <div className="flex justify-end mb-4 relative">
          <button
            onClick={() => setShowDownload((v) => !v)}
            disabled={entries.length === 0}
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium disabled:opacity-40"
            style={{ background: "#4ECDC4", color: "#181425" }}
          >
            <Download size={14} /> Descargar horario
          </button>
          {showDownload && (
            <div className="absolute top-full right-0 mt-2 rounded-lg overflow-hidden z-10" style={{ background: "#211C33", border: "1px solid #3A3355", minWidth: 220 }}>
              <button
                onClick={() => { downloadBlob(buildIcs(entries), "mi_horario.ics", "text/calendar"); setShowDownload(false); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left"
                style={{ color: "#F1EEFC" }}
              >
                <Calendar size={14} /> Calendario (.ics)
              </button>
              <button
                onClick={() => { downloadBlob(buildTxt(entries), "mi_horario.txt", "text/plain"); setShowDownload(false); }}
                className="w-full flex items-center gap-2 px-4 py-3 text-sm text-left"
                style={{ color: "#F1EEFC", borderTop: "1px solid #3A3355" }}
              >
                <FileText size={14} /> Lista de texto (.txt)
              </button>
            </div>
          )}
        </div>

        <div className="rounded-lg overflow-x-auto scrollbar-thin" style={{ background: "#211C33", border: "1px solid #3A3355" }}>
          {entries.length === 0 && loaded && (
            <div className="text-center py-12 px-6">
              <Calendar size={28} className="mx-auto mb-3" style={{ color: "#9B93B8" }} strokeWidth={1.5} />
              <p className="text-sm" style={{ color: "#F1EEFC" }}>Tu horario está vacío</p>
              <p className="font-mono text-xs mt-1" style={{ color: "#9B93B8" }}>Cuéntale a la IA arriba tu primera actividad para empezar.</p>
            </div>
          )}

          {entries.length > 0 && (
            <table className="w-full border-collapse" style={{ minWidth: 640 }}>
              <thead>
                <tr>
                  <th className="font-mono text-[10px] py-2 px-2 text-right sticky left-0" style={{ color: "#9B93B8", background: "#211C33", width: 56 }}>hora</th>
                  {DAYS.map((d) => (
                    <th key={d.id} className="font-mono text-xs py-2 px-1 text-center" style={{ color: "#A78BFA", borderLeft: "1px solid #3A3355" }}>{d.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HOURS.map((h) => (
                  <tr key={h}>
                    <td className="font-mono text-[10px] px-2 py-1.5 text-right sticky left-0" style={{ color: "#9B93B8", background: "#211C33" }}>{pad(h)}:00</td>
                    {DAYS.map((d) => {
                      const entry = entryAtHour(d.id, h);
                      const color = entry ? colorForActivity(entry.activity) : null;
                      return (
                        <td key={d.id} className="px-1 py-1 align-top" style={{ borderLeft: "1px solid #3A3355", borderTop: "1px solid #2A2540", minWidth: 76 }}>
                          {entry && (
                            <div className="group relative rounded px-1.5 py-1 text-[10px] leading-tight" style={{ background: color.bg, color: "#F1EEFC", border: `1px solid ${color.border}` }}>
                              {entry.activity}
                              <button
                                onClick={() => deleteEntry(entry.id)}
                                className="hidden group-hover:flex absolute -top-1.5 -right-1.5 items-center justify-center rounded-full"
                                style={{ background: "#FF6B6B", width: 14, height: 14 }}
                                aria-label="Eliminar"
                              >
                                <X size={9} color="#181425" />
                              </button>
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
