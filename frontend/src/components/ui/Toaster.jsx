import React, { createContext, useContext, useState, useCallback } from "react";

const ToasterContext = createContext(null);
let externalPush = null;

export function useToast() {
  // simple top-level helper that doesn't require provider parent
  return {
    toast: (opts) => {
      if (externalPush) externalPush(opts);
      else console.log("[toast]", opts);
    },
  };
}

export function Toaster() {
  const [items, setItems] = useState([]);

  const push = useCallback((opts) => {
    const id = Math.random().toString(36).slice(2);
    const item = { id, title: opts.title || "", description: opts.description || "", variant: opts.variant || "default" };
    setItems((p) => [...p, item]);
    setTimeout(() => setItems((p) => p.filter((x) => x.id !== id)), 4200);
  }, []);

  React.useEffect(() => {
    externalPush = push;
    return () => { externalPush = null; };
  }, [push]);

  return (
    <div className="fixed top-4 right-4 z-[100] flex flex-col gap-2 w-[320px]" data-testid="toaster">
      {items.map((t) => (
        <div
          key={t.id}
          className={`pointer-events-auto rounded-xl border px-4 py-3 backdrop-blur-xl shadow-card ${
            t.variant === "destructive"
              ? "bg-[rgba(255,51,102,0.12)] border-[#FF3366]/40 text-[#FF8FA9]"
              : t.variant === "success"
              ? "bg-[rgba(209,255,77,0.12)] border-[#D1FF4D]/40 text-[#D1FF4D]"
              : "bg-[#121212]/80 border-white/10 text-white"
          }`}
          data-testid={`toast-${t.variant}`}
        >
          {t.title && <div className="font-semibold text-sm">{t.title}</div>}
          {t.description && <div className="text-xs opacity-80 mt-0.5 leading-relaxed">{t.description}</div>}
        </div>
      ))}
    </div>
  );
}
