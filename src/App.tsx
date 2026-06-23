import { useState, useEffect, useCallback } from "react";
import { db } from "./firebase";
import {
  collection, onSnapshot, addDoc, deleteDoc,
  doc, setDoc, getDocs, query, orderBy
} from "firebase/firestore";

const DEFAULT_USERS = ["Elmira", "Aaron", "Daniel", "Ben", "Christian", "Janina"];

// ── German public holidays ──
function getEaster(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}
function getHolidays(year) {
  const easter = getEaster(year);
  const add = (d, n) => { const r = new Date(d); r.setDate(r.getDate() + n); return r; };
  const fmt = d => d.toISOString().split("T")[0];
  return {
    [fmt(new Date(year, 0, 1))]: "Neujahr",
    [fmt(add(easter, -2))]: "Karfreitag",
    [fmt(easter)]: "Ostersonntag",
    [fmt(add(easter, 1))]: "Ostermontag",
    [fmt(new Date(year, 4, 1))]: "Tag der Arbeit",
    [fmt(add(easter, 39))]: "Christi Himmelfahrt",
    [fmt(add(easter, 49))]: "Pfingstsonntag",
    [fmt(add(easter, 50))]: "Pfingstmontag",
    [fmt(new Date(year, 9, 3))]: "Tag der Deutschen Einheit",
    [fmt(new Date(year, 11, 25))]: "1. Weihnachtstag",
    [fmt(new Date(year, 11, 26))]: "2. Weihnachtstag",
  };
}

const SOLARBYTE_LOGO = () => (
  <svg width="130" height="44" viewBox="0 0 130 44" fill="none" xmlns="http://www.w3.org/2000/svg">
    <text x="0" y="30" fontFamily="'Arial Black', 'Arial', sans-serif" fontWeight="900" fontSize="26" fill="#F8FAFC" letterSpacing="-0.5">SOLAR</text>
    <text x="72" y="30" fontFamily="'Arial', sans-serif" fontWeight="400" fontSize="22" fill="#F8FAFC">Byte</text>
    <path d="M 8 36 Q 65 58 118 36" stroke="#F59E0B" strokeWidth="3.5" fill="none" strokeLinecap="round"/>
  </svg>
);

function formatDate(iso) {
  return new Date(iso).toLocaleDateString("de-DE", { weekday: "short", day: "2-digit", month: "2-digit", year: "numeric" });
}
function formatHours(h) {
  if (!h || h === 0) return "0h";
  const hours = Math.floor(h);
  const mins = Math.round((h - hours) * 60);
  return `${hours}h${mins > 0 ? " " + mins + "m" : ""}`;
}
function getCurrentWeekDates() {
  const now = new Date();
  const day = now.getDay();
  const monday = new Date(now);
  monday.setDate(now.getDate() - ((day + 6) % 7));
  const dates = [];
  for (let i = 0; i < 5; i++) {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    dates.push(d.toISOString().split("T")[0]);
  }
  return dates;
}
function getDaysInMonth(year, month) {
  return new Date(year, month + 1, 0).getDate();
}

const CATEGORIES = ["Entwicklung", "Support", "Meeting", "Administration", "Kundenprojekt", "Sonstiges"];
const WEEKDAYS = ["Mo", "Di", "Mi", "Do", "Fr", "Sa", "So"];
const MONTH_NAMES = ["Januar","Februar","März","April","Mai","Juni","Juli","August","September","Oktober","November","Dezember"];

// ── User Modal ──
function UserModal({ users, onSave, onClose }) {
  const [local, setLocal] = useState([...users]);
  const [newName, setNewName] = useState("");
  const [editIdx, setEditIdx] = useState(null);
  const [editVal, setEditVal] = useState("");
  const [err, setErr] = useState("");
  const inp = { background: "#0F172A", color: "#E2E8F0", border: "1px solid #334155", borderRadius: 8, padding: "7px 11px", fontSize: 13, width: "100%" };

  function add() {
    const n = newName.trim();
    if (!n) return;
    if (local.includes(n)) { setErr("Existiert bereits"); return; }
    setLocal([...local, n]); setNewName(""); setErr("");
  }
  function edit(i) { setEditIdx(i); setEditVal(local[i]); setErr(""); }
  function saveEdit(i) {
    const n = editVal.trim();
    if (!n) { setErr("Name darf nicht leer sein"); return; }
    if (local.some((u, j) => u === n && j !== i)) { setErr("Existiert bereits"); return; }
    const u = [...local]; u[i] = n; setLocal(u); setEditIdx(null); setErr("");
  }
  function remove(i) { setLocal(local.filter((_, j) => j !== i)); if (editIdx === i) setEditIdx(null); }

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 16, padding: 26, width: 370, maxWidth: "95vw", maxHeight: "88vh", overflowY: "auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Mitarbeiter verwalten</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        {local.map((u, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 7, background: "#0F172A", borderRadius: 8, padding: "8px 11px", border: "1px solid #1E293B" }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
            {editIdx === i
              ? <><input value={editVal} onChange={e => setEditVal(e.target.value)} onKeyDown={e => { if (e.key === "Enter") saveEdit(i); if (e.key === "Escape") setEditIdx(null); }} autoFocus style={{ ...inp, flex: 1, padding: "4px 8px" }} />
                <button onClick={() => saveEdit(i)} style={{ background: "#F59E0B", color: "#0F172A", border: "none", borderRadius: 6, padding: "4px 9px", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>✓</button>
                <button onClick={() => setEditIdx(null)} style={{ background: "#334155", color: "#94A3B8", border: "none", borderRadius: 6, padding: "4px 9px", fontSize: 12, cursor: "pointer" }}>✕</button></>
              : <><span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{u}</span>
                <button onClick={() => edit(i)} style={{ background: "#334155", color: "#94A3B8", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>✏️</button>
                <button onClick={() => remove(i)} style={{ background: "#450A0A", color: "#FCA5A5", border: "none", borderRadius: 6, padding: "3px 9px", fontSize: 11, cursor: "pointer" }}>🗑</button></>
            }
          </div>
        ))}
        <div style={{ borderTop: "1px solid #334155", paddingTop: 14, marginTop: 8 }}>
          <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 7 }}>Neu hinzufügen</div>
          <div style={{ display: "flex", gap: 7 }}>
            <input value={newName} onChange={e => { setNewName(e.target.value); setErr(""); }} onKeyDown={e => e.key === "Enter" && add()} placeholder="Name" style={{ ...inp, flex: 1 }} />
            <button onClick={add} style={{ background: "#F59E0B", color: "#0F172A", border: "none", borderRadius: 8, padding: "7px 14px", fontWeight: 800, fontSize: 15, cursor: "pointer" }}>+</button>
          </div>
          {err && <div style={{ color: "#FCA5A5", fontSize: 11, marginTop: 5 }}>{err}</div>}
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 18 }}>
          <button onClick={onClose} style={{ flex: 1, background: "#334155", color: "#94A3B8", border: "none", borderRadius: 8, padding: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Abbrechen</button>
          <button onClick={() => onSave(local)} style={{ flex: 1, background: "#F59E0B", color: "#0F172A", border: "none", borderRadius: 8, padding: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Calendar ──
function CalendarView({ year, month, entries, absences, currentUser, holidays, onDayClick }) {
  const daysInMonth = getDaysInMonth(year, month);
  const firstDay = new Date(year, month, 1).getDay();
  const offset = (firstDay + 6) % 7;
  const dayEntries = {};
  entries.filter(e => e.user === currentUser).forEach(e => {
    if (!dayEntries[e.date]) dayEntries[e.date] = 0;
    dayEntries[e.date] += e.hours;
  });
  const dayAbsences = {};
  absences.filter(a => a.user === currentUser).forEach(a => {
    for (let d = new Date(a.from); d <= new Date(a.to); d.setDate(d.getDate() + 1)) {
      dayAbsences[d.toISOString().split("T")[0]] = a.type;
    }
  });
  const cells = [];
  for (let i = 0; i < offset; i++) cells.push(null);
  for (let d = 1; d <= daysInMonth; d++) cells.push(d);
  const today = new Date().toISOString().split("T")[0];

  return (
    <div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 2, marginBottom: 2 }}>
        {WEEKDAYS.map(d => <div key={d} style={{ textAlign: "center", fontSize: 10, fontWeight: 700, color: "#475569", padding: "4px 0", textTransform: "uppercase" }}>{d}</div>)}
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(7, 1fr)", gap: 3 }}>
        {cells.map((d, i) => {
          if (!d) return <div key={i} />;
          const iso = `${year}-${String(month + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
          const dow = i % 7;
          const isWeekend = dow >= 5;
          const isToday = iso === today;
          const holiday = holidays[iso];
          const absence = dayAbsences[iso];
          const hrs = dayEntries[iso];
          let bg = "#0F172A", border = "1px solid #1E293B";
          if (holiday) { bg = "#1a1a2e"; border = "1px solid #6366F1"; }
          else if (isWeekend) bg = "#111827";
          if (absence === "urlaub") { bg = "#0C2A1E"; border = "1px solid #10B981"; }
          if (absence === "krank") { bg = "#2A0C0C"; border = "1px solid #EF4444"; }
          if (isToday) border = "2px solid #F59E0B";
          return (
            <div key={i} onClick={() => !isWeekend && !holiday && onDayClick(iso)}
              title={holiday || (absence === "urlaub" ? "Urlaub" : absence === "krank" ? "Krank" : "")}
              style={{ background: bg, border, borderRadius: 6, padding: "5px 4px", minHeight: 44, cursor: (!isWeekend && !holiday) ? "pointer" : "default", opacity: isWeekend ? 0.45 : 1 }}>
              <div style={{ fontSize: 12, fontWeight: isToday ? 800 : 500, color: isToday ? "#F59E0B" : holiday ? "#818CF8" : "#94A3B8", textAlign: "center" }}>{d}</div>
              {holiday && <div style={{ fontSize: 8, color: "#818CF8", textAlign: "center", lineHeight: 1.2, marginTop: 1 }}>{holiday.split(" ")[0]}</div>}
              {absence === "urlaub" && <div style={{ fontSize: 9, color: "#10B981", textAlign: "center", marginTop: 1 }}>🌴</div>}
              {absence === "krank" && <div style={{ fontSize: 9, color: "#EF4444", textAlign: "center", marginTop: 1 }}>🤒</div>}
              {hrs && !absence && <div style={{ fontSize: 9, color: "#F59E0B", textAlign: "center", marginTop: 1 }}>{formatHours(hrs)}</div>}
            </div>
          );
        })}
      </div>
      <div style={{ display: "flex", gap: 14, marginTop: 12, flexWrap: "wrap" }}>
        {[["#F59E0B", "Arbeitsstunden"], ["#10B981", "Urlaub"], ["#EF4444", "Krank"], ["#6366F1", "Feiertag"]].map(([c, l]) => (
          <div key={l} style={{ display: "flex", alignItems: "center", gap: 5, fontSize: 11, color: "#64748B" }}>
            <div style={{ width: 8, height: 8, borderRadius: 2, background: c }} />{l}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Absence Modal ──
function AbsenceModal({ date, absences, currentUser, onSave, onDelete, onClose }) {
  const existing = absences.find(a => a.user === currentUser && a.from <= date && a.to >= date);
  const [type, setType] = useState(existing?.type || "urlaub");
  const [from, setFrom] = useState(existing?.from || date);
  const [to, setTo] = useState(existing?.to || date);
  const inp = { background: "#0F172A", color: "#E2E8F0", border: "1px solid #334155", borderRadius: 8, padding: "7px 10px", fontSize: 13, width: "100%" };

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.72)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ background: "#1E293B", border: "1px solid #334155", borderRadius: 16, padding: 26, width: 340, maxWidth: "95vw" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
          <span style={{ fontWeight: 800, fontSize: 15 }}>Abwesenheit eintragen</span>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748B", cursor: "pointer", fontSize: 18 }}>✕</button>
        </div>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {[["urlaub", "🌴 Urlaub", "#10B981", "#0C2A1E"], ["krank", "🤒 Krank", "#EF4444", "#2A0C0C"]].map(([v, label, col, bg]) => (
            <button key={v} onClick={() => setType(v)} style={{ flex: 1, background: type === v ? bg : "#0F172A", color: type === v ? col : "#64748B", border: `2px solid ${type === v ? col : "#334155"}`, borderRadius: 8, padding: 10, fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{label}</button>
          ))}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 16 }}>
          <div><label style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Von</label><input type="date" value={from} onChange={e => setFrom(e.target.value)} style={{ ...inp, marginTop: 4 }} /></div>
          <div><label style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Bis</label><input type="date" value={to} min={from} onChange={e => setTo(e.target.value)} style={{ ...inp, marginTop: 4 }} /></div>
        </div>
        {existing && <button onClick={() => onDelete(existing.id)} style={{ width: "100%", background: "#450A0A", color: "#FCA5A5", border: "none", borderRadius: 8, padding: 8, fontWeight: 600, fontSize: 13, cursor: "pointer", marginBottom: 8 }}>Abwesenheit löschen</button>}
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onClose} style={{ flex: 1, background: "#334155", color: "#94A3B8", border: "none", borderRadius: 8, padding: 10, fontWeight: 600, fontSize: 13, cursor: "pointer" }}>Abbrechen</button>
          <button onClick={() => onSave({ id: existing?.id, user: currentUser, type, from, to })} style={{ flex: 1, background: "#F59E0B", color: "#0F172A", border: "none", borderRadius: 8, padding: 10, fontWeight: 800, fontSize: 13, cursor: "pointer" }}>Speichern</button>
        </div>
      </div>
    </div>
  );
}

// ── Main App ──
export default function App() {
  const [view, setView] = useState("log");
  const [users, setUsers] = useState(DEFAULT_USERS);
  const [currentUser, setCurrentUser] = useState(DEFAULT_USERS[0]);
  const [entries, setEntries] = useState([]);
  const [absences, setAbsences] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showUserModal, setShowUserModal] = useState(false);
  const [absenceDay, setAbsenceDay] = useState(null);
  const now = new Date();
  const [calYear, setCalYear] = useState(now.getFullYear());
  const [calMonth, setCalMonth] = useState(now.getMonth());
  const [form, setForm] = useState({ date: now.toISOString().split("T")[0], start: "09:00", end: "13:00", category: "Entwicklung" });
  const [toast, setToast] = useState(null);
  const [filterUser, setFilterUser] = useState("all");
  const [filterMonth, setFilterMonth] = useState(now.toISOString().slice(0, 7));

  const holidays = getHolidays(calYear);

  // ── Firebase realtime listeners ──
  useEffect(() => {
    // Load users config
    const usersRef = doc(db, "config", "users");
    getDocs(collection(db, "config")).then(snap => {
      snap.forEach(d => { if (d.id === "users" && d.data().list) { setUsers(d.data().list); setCurrentUser(d.data().list[0]); } });
    });

    // Listen to entries in realtime
    const unsubEntries = onSnapshot(
      query(collection(db, "entries"), orderBy("date", "desc")),
      snap => { setEntries(snap.docs.map(d => ({ ...d.data(), id: d.id }))); setLoading(false); },
      () => setLoading(false)
    );

    // Listen to absences in realtime
    const unsubAbsences = onSnapshot(
      collection(db, "absences"),
      snap => setAbsences(snap.docs.map(d => ({ ...d.data(), id: d.id })))
    );

    return () => { unsubEntries(); unsubAbsences(); };
  }, []);

  const showToast = (msg, type = "success") => { setToast({ msg, type }); setTimeout(() => setToast(null), 3000); };

  function calcHours(start, end) {
    const [sh, sm] = start.split(":").map(Number);
    const [eh, em] = end.split(":").map(Number);
    return Math.max(0, (eh * 60 + em - sh * 60 - sm) / 60);
  }

  async function handleAdd() {
    const h = calcHours(form.start, form.end);
    if (h <= 0) { showToast("Endzeit muss nach Startzeit liegen", "error"); return; }
    try {
      await addDoc(collection(db, "entries"), { user: currentUser, date: form.date, start: form.start, end: form.end, hours: h, category: form.category, createdAt: Date.now() });
      showToast("Stunden eingetragen ✓");
    } catch (e) { showToast("Fehler beim Speichern", "error"); }
  }

  async function handleDelete(id) {
    try { await deleteDoc(doc(db, "entries", id)); showToast("Eintrag gelöscht"); }
    catch (e) { showToast("Fehler beim Löschen", "error"); }
  }

  async function handleSaveUsers(newUsers) {
    try {
      await setDoc(doc(db, "config", "users"), { list: newUsers });
      setUsers(newUsers);
      if (!newUsers.includes(currentUser)) setCurrentUser(newUsers[0] || "");
      setShowUserModal(false);
      showToast("Mitarbeiter aktualisiert ✓");
    } catch (e) { showToast("Fehler beim Speichern", "error"); }
  }

  async function handleSaveAbsence(absence) {
    try {
      if (absence.id) {
        await setDoc(doc(db, "absences", absence.id), { user: absence.user, type: absence.type, from: absence.from, to: absence.to });
      } else {
        await addDoc(collection(db, "absences"), { user: absence.user, type: absence.type, from: absence.from, to: absence.to });
      }
      showToast("Abwesenheit gespeichert ✓");
    } catch (e) { showToast("Fehler beim Speichern", "error"); }
    setAbsenceDay(null);
  }

  async function handleDeleteAbsence(id) {
    try { await deleteDoc(doc(db, "absences", id)); showToast("Abwesenheit gelöscht"); }
    catch (e) { showToast("Fehler beim Löschen", "error"); }
    setAbsenceDay(null);
  }

  const filteredEntries = entries.filter(e => (filterUser === "all" || e.user === filterUser) && e.date.startsWith(filterMonth));
  const myMonthEntries = entries.filter(e => e.user === currentUser && e.date.startsWith(filterMonth));
  const myMonthHours = myMonthEntries.reduce((s, e) => s + e.hours, 0);
  const myWeekHours = entries.filter(e => e.user === currentUser && getCurrentWeekDates().includes(e.date)).reduce((s, e) => s + e.hours, 0);

  const myMonthAbsences = { urlaub: 0, krank: 0 };
  absences.filter(a => a.user === currentUser).forEach(a => {
    for (let d = new Date(a.from); d <= new Date(a.to); d.setDate(d.getDate() + 1)) {
      const iso = d.toISOString().split("T")[0];
      if (iso.startsWith(filterMonth)) myMonthAbsences[a.type]++;
    }
  });

  const teamStats = users.map(u => ({
    user: u,
    month: entries.filter(e => e.user === u && e.date.startsWith(filterMonth)).reduce((s, e) => s + e.hours, 0),
    week: entries.filter(e => e.user === u && getCurrentWeekDates().includes(e.date)).reduce((s, e) => s + e.hours, 0),
    urlaubMonth: (() => { let c = 0; absences.filter(a => a.user === u && a.type === "urlaub").forEach(a => { for (let d = new Date(a.from); d <= new Date(a.to); d.setDate(d.getDate()+1)) { if (d.toISOString().split("T")[0].startsWith(filterMonth)) c++; } }); return c; })(),
    krankMonth: (() => { let c = 0; absences.filter(a => a.user === u && a.type === "krank").forEach(a => { for (let d = new Date(a.from); d <= new Date(a.to); d.setDate(d.getDate()+1)) { if (d.toISOString().split("T")[0].startsWith(filterMonth)) c++; } }); return c; })(),
  }));

  const inp = { background: "#0F172A", color: "#E2E8F0", border: "1px solid #334155", borderRadius: 8, padding: "8px 10px", fontSize: 13, width: "100%", marginTop: 4 };

  return (
    <div style={{ minHeight: "100vh", background: "#0F172A", color: "#E2E8F0", fontFamily: "'Inter', system-ui, sans-serif" }}>
      {toast && <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, background: toast.type === "error" ? "#EF4444" : "#10B981", color: "#fff", padding: "10px 20px", borderRadius: 10, fontWeight: 600, fontSize: 14, boxShadow: "0 4px 20px rgba(0,0,0,0.4)" }}>{toast.msg}</div>}
      {showUserModal && <UserModal users={users} onSave={handleSaveUsers} onClose={() => setShowUserModal(false)} />}
      {absenceDay && <AbsenceModal date={absenceDay} absences={absences} currentUser={currentUser} onSave={handleSaveAbsence} onDelete={handleDeleteAbsence} onClose={() => setAbsenceDay(null)} />}

      {/* Header */}
      <div style={{ background: "#1E293B", borderBottom: "1px solid #334155", padding: "14px 20px", display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <div style={{ display: "flex", flexDirection: "column" }}>
          <SOLARBYTE_LOGO />
          <div style={{ fontSize: 11, color: "#94A3B8", fontWeight: 600, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: -2, paddingLeft: 2 }}>Zeiterfassung</div>
        </div>
        <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          <select value={currentUser} onChange={e => setCurrentUser(e.target.value)}
            style={{ background: "#334155", color: "#E2E8F0", border: "none", borderRadius: 8, padding: "6px 11px", fontSize: 13, fontWeight: 600, cursor: "pointer" }}>
            {users.map(u => <option key={u} value={u}>{u}</option>)}
          </select>
          <button onClick={() => setShowUserModal(true)} style={{ background: "#334155", color: "#94A3B8", border: "none", borderRadius: 8, padding: "6px 11px", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>⚙ Verwalten</button>
        </div>
      </div>

      {/* Nav */}
      <div style={{ display: "flex", gap: 3, padding: "14px 20px 0" }}>
        {[["log","Stunden"], ["calendar","Kalender"], ["overview","Übersicht"], ["team","Team"]].map(([v, l]) => (
          <button key={v} onClick={() => setView(v)} style={{ background: view === v ? "#F59E0B" : "#1E293B", color: view === v ? "#0F172A" : "#94A3B8", border: "none", borderRadius: "8px 8px 0 0", padding: "8px 16px", fontWeight: 700, fontSize: 13, cursor: "pointer" }}>{l}</button>
        ))}
      </div>

      <div style={{ padding: "0 20px 32px", maxWidth: 860, margin: "0 auto" }}>

        {/* LOG */}
        {view === "log" && (
          <div style={{ background: "#1E293B", borderRadius: "0 12px 12px 12px", border: "1px solid #334155", padding: 22 }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 10, marginBottom: 20 }}>
              {[
                { label: "Diese Woche", value: formatHours(myWeekHours), sub: "Ziel: ~20h" },
                { label: `Monat ${filterMonth.slice(5)}`, value: formatHours(myMonthHours), sub: `${myMonthEntries.length} Einträge` },
                { label: "Urlaub (Monat)", value: `${myMonthAbsences.urlaub}d`, sub: "🌴", col: "#10B981" },
                { label: "Krank (Monat)", value: `${myMonthAbsences.krank}d`, sub: "🤒", col: "#EF4444" },
              ].map(card => (
                <div key={card.label} style={{ background: "#0F172A", borderRadius: 10, padding: "12px 14px", border: "1px solid #334155" }}>
                  <div style={{ fontSize: 10, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 3 }}>{card.label}</div>
                  <div style={{ fontSize: 20, fontWeight: 800, color: card.col || "#F59E0B" }}>{card.value}</div>
                  <div style={{ fontSize: 10, color: "#475569" }}>{card.sub}</div>
                </div>
              ))}
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(110px, 1fr))", gap: 9, marginBottom: 14 }}>
              <div><label style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Datum</label><input type="date" value={form.date} onChange={e => setForm(f => ({ ...f, date: e.target.value }))} style={inp} /></div>
              <div><label style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Von</label><input type="time" value={form.start} onChange={e => setForm(f => ({ ...f, start: e.target.value }))} style={inp} /></div>
              <div><label style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Bis</label><input type="time" value={form.end} onChange={e => setForm(f => ({ ...f, end: e.target.value }))} style={inp} /></div>
              <div>
                <label style={{ fontSize: 11, color: "#64748B", fontWeight: 600 }}>Kategorie</label>
                <select value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} style={{ ...inp, cursor: "pointer" }}>
                  {CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </div>

            <div style={{ display: "flex", gap: 9, marginBottom: 22, flexWrap: "wrap" }}>
              <button onClick={handleAdd} style={{ background: "#F59E0B", color: "#0F172A", border: "none", borderRadius: 8, padding: "9px 20px", fontWeight: 800, fontSize: 14, cursor: "pointer" }}>
                + Eintragen ({calcHours(form.start, form.end) > 0 ? formatHours(calcHours(form.start, form.end)) : "—"})
              </button>
              <button onClick={() => { setCalYear(new Date(form.date).getFullYear()); setCalMonth(new Date(form.date).getMonth()); setAbsenceDay(form.date); }} style={{ background: "#0C2A1E", color: "#10B981", border: "1px solid #10B981", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                🌴 Urlaub eintragen
              </button>
              <button onClick={() => { setCalYear(new Date(form.date).getFullYear()); setCalMonth(new Date(form.date).getMonth()); setAbsenceDay(form.date); }} style={{ background: "#2A0C0C", color: "#EF4444", border: "1px solid #EF4444", borderRadius: 8, padding: "9px 14px", fontWeight: 600, fontSize: 13, cursor: "pointer" }}>
                🤒 Krankmeldung
              </button>
            </div>

            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, marginBottom: 7, textTransform: "uppercase" }}>Meine letzten Einträge</div>
            {loading && <div style={{ color: "#475569", fontSize: 13 }}>Verbinde mit Datenbank...</div>}
            {entries.filter(e => e.user === currentUser).slice(0, 15).map(entry => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#0F172A", borderRadius: 8, marginBottom: 5, border: "1px solid #1E293B" }}>
                <div style={{ width: 3, height: 32, borderRadius: 4, background: "#F59E0B", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(entry.date)} · {entry.start}–{entry.end}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{entry.category}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#F59E0B", minWidth: 44, textAlign: "right" }}>{formatHours(entry.hours)}</div>
                <button onClick={() => handleDelete(entry.id)} style={{ background: "none", border: "none", color: "#475569", cursor: "pointer", fontSize: 15, padding: 3 }}>✕</button>
              </div>
            ))}
            {!loading && entries.filter(e => e.user === currentUser).length === 0 && <div style={{ color: "#475569", fontSize: 13, textAlign: "center", padding: 20 }}>Noch keine Einträge.</div>}
          </div>
        )}

        {/* CALENDAR */}
        {view === "calendar" && (
          <div style={{ background: "#1E293B", borderRadius: "0 12px 12px 12px", border: "1px solid #334155", padding: 22 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
              <button onClick={() => { let m = calMonth - 1; let y = calYear; if (m < 0) { m = 11; y--; } setCalMonth(m); setCalYear(y); }}
                style={{ background: "#334155", border: "none", color: "#E2E8F0", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>‹</button>
              <div style={{ fontWeight: 800, fontSize: 16, flex: 1, textAlign: "center" }}>{MONTH_NAMES[calMonth]} {calYear}</div>
              <button onClick={() => { let m = calMonth + 1; let y = calYear; if (m > 11) { m = 0; y++; } setCalMonth(m); setCalYear(y); }}
                style={{ background: "#334155", border: "none", color: "#E2E8F0", borderRadius: 7, padding: "5px 12px", cursor: "pointer", fontWeight: 700, fontSize: 15 }}>›</button>
            </div>
            <CalendarView year={calYear} month={calMonth} entries={entries} absences={absences} currentUser={currentUser} holidays={holidays} onDayClick={setAbsenceDay} />
            <div style={{ marginTop: 16, padding: "12px 14px", background: "#0F172A", borderRadius: 10, border: "1px solid #334155", fontSize: 12, color: "#64748B" }}>
              💡 Klicke auf einen Werktag, um Urlaub oder Krankmeldung einzutragen.
            </div>
          </div>
        )}

        {/* OVERVIEW */}
        {view === "overview" && (
          <div style={{ background: "#1E293B", borderRadius: "0 12px 12px 12px", border: "1px solid #334155", padding: 22 }}>
            <div style={{ display: "flex", gap: 9, marginBottom: 18 }}>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ background: "#0F172A", color: "#E2E8F0", border: "1px solid #334155", borderRadius: 8, padding: "6px 11px", fontSize: 13 }} />
            </div>
            {(() => {
              const byCat = {};
              myMonthEntries.forEach(e => { byCat[e.category] = (byCat[e.category] || 0) + e.hours; });
              const total = Object.values(byCat).reduce((a, b) => a + b, 0);
              return Object.entries(byCat).length > 0 ? (
                <div style={{ marginBottom: 22 }}>
                  <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Kategorien – {filterMonth}</div>
                  {Object.entries(byCat).sort((a, b) => b[1] - a[1]).map(([cat, h]) => (
                    <div key={cat} style={{ marginBottom: 8 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 13, marginBottom: 3 }}><span>{cat}</span><span style={{ fontWeight: 700, color: "#F59E0B" }}>{formatHours(h)}</span></div>
                      <div style={{ background: "#0F172A", borderRadius: 4, height: 5 }}><div style={{ background: "#F59E0B", height: 5, borderRadius: 4, width: `${Math.round((h / total) * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              ) : <div style={{ color: "#475569", fontSize: 13, marginBottom: 16 }}>Keine Arbeitsstunden für diesen Monat.</div>;
            })()}
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Alle Einträge</div>
            {[...myMonthEntries].sort((a, b) => b.date.localeCompare(a.date)).map(entry => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#0F172A", borderRadius: 8, marginBottom: 5, border: "1px solid #1E293B" }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{formatDate(entry.date)} · {entry.start}–{entry.end}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{entry.category}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#F59E0B" }}>{formatHours(entry.hours)}</div>
              </div>
            ))}
          </div>
        )}

        {/* TEAM */}
        {view === "team" && (
          <div style={{ background: "#1E293B", borderRadius: "0 12px 12px 12px", border: "1px solid #334155", padding: 22 }}>
            <div style={{ display: "flex", gap: 9, marginBottom: 18, flexWrap: "wrap" }}>
              <input type="month" value={filterMonth} onChange={e => setFilterMonth(e.target.value)} style={{ background: "#0F172A", color: "#E2E8F0", border: "1px solid #334155", borderRadius: 8, padding: "6px 11px", fontSize: 13 }} />
              <select value={filterUser} onChange={e => setFilterUser(e.target.value)} style={{ background: "#0F172A", color: "#E2E8F0", border: "1px solid #334155", borderRadius: 8, padding: "6px 11px", fontSize: 13 }}>
                <option value="all">Alle</option>
                {users.map(u => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 9, marginBottom: 22 }}>
              {teamStats.map(s => (
                <div key={s.user} style={{ background: "#0F172A", borderRadius: 10, padding: "12px 14px", border: "1px solid #334155" }}>
                  <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 5 }}>{s.user}</div>
                  <div style={{ fontSize: 10, color: "#64748B" }}>Diese Woche</div>
                  <div style={{ fontSize: 17, fontWeight: 800, color: "#F59E0B" }}>{formatHours(s.week)}</div>
                  <div style={{ fontSize: 10, color: "#64748B", marginTop: 4 }}>Monat: {formatHours(s.month)}</div>
                  <div style={{ display: "flex", gap: 8, marginTop: 5 }}>
                    {s.urlaubMonth > 0 && <span style={{ fontSize: 10, color: "#10B981" }}>🌴 {s.urlaubMonth}d</span>}
                    {s.krankMonth > 0 && <span style={{ fontSize: 10, color: "#EF4444" }}>🤒 {s.krankMonth}d</span>}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize: 11, color: "#64748B", fontWeight: 600, textTransform: "uppercase", marginBottom: 10 }}>Alle Einträge</div>
            {filteredEntries.length === 0 && <div style={{ color: "#475569", fontSize: 13 }}>Keine Einträge für diesen Zeitraum.</div>}
            {[...filteredEntries].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 30).map(entry => (
              <div key={entry.id} style={{ display: "flex", alignItems: "center", gap: 10, padding: "9px 12px", background: "#0F172A", borderRadius: 8, marginBottom: 5, border: "1px solid #1E293B" }}>
                <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#F59E0B", flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{entry.user} · {formatDate(entry.date)}</div>
                  <div style={{ fontSize: 11, color: "#64748B" }}>{entry.start}–{entry.end} · {entry.category}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 800, color: "#F59E0B" }}>{formatHours(entry.hours)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
