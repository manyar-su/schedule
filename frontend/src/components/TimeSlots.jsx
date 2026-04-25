import React from "react";

export default function TimeSlots({ slots = [], selected, onSelect, loading }) {
  if (loading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" data-testid="time-slots-loading">
        {Array.from({ length: 9 }).map((_, i) => (
          <div key={i} className="slot-chip disabled !animate-pulse opacity-50">--:--</div>
        ))}
      </div>
    );
  }
  if (!slots.length) {
    return <div className="text-textS text-sm font-mono">Pilih tanggal terlebih dahulu</div>;
  }
  return (
    <div className="grid grid-cols-3 sm:grid-cols-4 gap-2.5" data-testid="time-slots-grid">
      {slots.map((s) => {
        const isSelected = selected === s.time;
        const cls = `slot-chip ${!s.available ? "disabled" : ""} ${isSelected ? "selected" : ""}`;
        return (
          <button
            key={s.time}
            type="button"
            disabled={!s.available}
            onClick={() => s.available && onSelect(s.time)}
            className={cls}
            data-testid={`time-slot-${s.time.replace(":", "")}`}
          >
            {s.time}
          </button>
        );
      })}
    </div>
  );
}
