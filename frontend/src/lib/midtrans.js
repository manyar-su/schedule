// Dynamic loader for Midtrans Snap.js
// Picks sandbox vs production URL based on `is_production` flag
let _loaded = null;

export function loadMidtransSnap({ clientKey, isProduction }) {
  if (_loaded) return _loaded;
  _loaded = new Promise((resolve, reject) => {
    const src = isProduction
      ? "https://app.midtrans.com/snap/snap.js"
      : "https://app.sandbox.midtrans.com/snap/snap.js";
    const existing = document.querySelector(`script[data-midtrans-snap="1"]`);
    if (existing && window.snap) return resolve(window.snap);

    const s = document.createElement("script");
    s.src = src;
    s.dataset.midtransSnap = "1";
    s.dataset.clientKey = clientKey;
    s.async = true;
    s.onload = () => {
      if (window.snap) resolve(window.snap);
      else reject(new Error("snap.js loaded but window.snap missing"));
    };
    s.onerror = () => reject(new Error("Gagal memuat Midtrans Snap.js"));
    document.head.appendChild(s);
  });
  return _loaded;
}

export function buildGoogleCalendarUrl({ title, description, location, startDate, endDate }) {
  // Date format expected: YYYYMMDDTHHMMSSZ (UTC) or local YYYYMMDDTHHMMSS
  const fmt = (d) =>
    `${d.getUTCFullYear()}${String(d.getUTCMonth() + 1).padStart(2, "0")}${String(d.getUTCDate()).padStart(2, "0")}T${String(d.getUTCHours()).padStart(2, "0")}${String(d.getUTCMinutes()).padStart(2, "0")}${String(d.getUTCSeconds()).padStart(2, "0")}Z`;

  const params = new URLSearchParams({
    action: "TEMPLATE",
    text: title,
    details: description,
    location: location || "Online via Zoom",
    dates: `${fmt(startDate)}/${fmt(endDate)}`,
  });
  return `https://calendar.google.com/calendar/render?${params.toString()}`;
}
