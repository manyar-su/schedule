import React, { useState, useMemo } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

const ID_MONTHS = [
  "Januari","Februari","Maret","April","Mei","Juni",
  "Juli","Agustus","September","Oktober","November","Desember"
];
const ID_DAYS = ["Min","Sen","Sel","Rab","Kam","Jum","Sab"];

function startOfMonth(year, month) { return new Date(year, month, 1); }
function isSameDay(a, b) { return a && b && a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate(); }
function isPast(d, today) {
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const b = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return a < b;
}

export default function Calendar({ selectedDate, onSelect }) {
  const today = new Date();
  const [view, setView] = useState({ y: today.getFullYear(), m: today.getMonth() });

  const cells = useMemo(() => {
    const first = startOfMonth(view.y, view.m);
    const startWeekday = first.getDay(); // 0=Sun
    const daysInMonth = new Date(view.y, view.m + 1, 0).getDate();
    const arr = [];
    // padding from prev month
    const prevMonthDays = new Date(view.y, view.m, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i--) {
      arr.push({ d: new Date(view.y, view.m - 1, prevMonthDays - i), other: true });
    }
    for (let i = 1; i <= daysInMonth; i++) {
      arr.push({ d: new Date(view.y, view.m, i), other: false });
    }
    while (arr.length % 7 !== 0) {
      const last = arr[arr.length - 1].d;
      arr.push({ d: new Date(last.getFullYear(), last.getMonth(), last.getDate() + 1), other: true });
    }
    return arr;
  }, [view]);

  const goPrev = () => setView((v) => v.m === 0 ? { y: v.y - 1, m: 11 } : { y: v.y, m: v.m - 1 });
  const goNext = () => setView((v) => v.m === 11 ? { y: v.y + 1, m: 0 } : { y: v.y, m: v.m + 1 });

  const minDate = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const maxDate = new Date(today.getFullYear(), today.getMonth() + 3, today.getDate());

  return (
    <div className="rounded-2xl border border-white/10 bg-[#121212] p-5 md:p-6" data-testid="calendar-container">
      <div className="flex items-center justify-between mb-5">
        <button
          type="button"
          onClick={goPrev}
          className="w-9 h-9 rounded-lg border border-white/10 hover:border-accent hover:text-accent flex items-center justify-center transition-all"
          data-testid="calendar-prev"
          aria-label="Bulan sebelumnya"
        >
          <ChevronLeft size={16} />
        </button>
        <div className="font-display font-semibold text-lg" data-testid="calendar-title">
          {ID_MONTHS[view.m]} <span className="text-accent">{view.y}</span>
        </div>
        <button
          type="button"
          onClick={goNext}
          className="w-9 h-9 rounded-lg border border-white/10 hover:border-accent hover:text-accent flex items-center justify-center transition-all"
          data-testid="calendar-next"
          aria-label="Bulan berikutnya"
        >
          <ChevronRight size={16} />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-1.5 mb-2 text-[11px] font-mono uppercase tracking-[0.18em] text-textS">
        {ID_DAYS.map((d, i) => (
          <div key={d} className={`text-center py-1 ${i === 0 ? "text-danger/70" : ""}`}>{d}</div>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1.5">
        {cells.map(({ d, other }, i) => {
          const sunday = d.getDay() === 0;
          const past = isPast(d, today) || d > maxDate;
          const disabled = other || past || sunday;
          const selected = isSameDay(d, selectedDate);
          const dateKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
          return (
            <button
              key={i}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onSelect(d)}
              data-testid={`calendar-day-${dateKey}`}
              className={`cal-day ${other ? "cal-other-month" : ""} ${disabled ? "cal-disabled" : ""} ${selected ? "cal-selected" : ""}`}
            >
              {d.getDate()}
            </button>
          );
        })}
      </div>

      <div className="mt-5 pt-4 border-t border-white/5 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] font-mono uppercase tracking-[0.18em] text-textS">
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-accent glow-dot" /> Tersedia</div>
        <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-white/15" /> Tutup</div>
        <div className="ml-auto opacity-60">Min — Hari Libur</div>
      </div>
    </div>
  );
}
