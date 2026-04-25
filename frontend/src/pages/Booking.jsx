import React, { useEffect, useState, useMemo } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowLeft, Check, CalendarCheck, ShoppingCart, Globe, Smartphone, Lightbulb, CalendarPlus, CreditCard } from "lucide-react";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import Calendar from "../components/Calendar";
import TimeSlots from "../components/TimeSlots";
import { api, formatApiErrorDetail, formatIDR, fmtDateID } from "../lib/api";
import { useToast } from "../components/ui/Toaster";
import { loadMidtransSnap, buildGoogleCalendarUrl } from "../lib/midtrans";

const ICONS = { ShoppingCart, Globe, Smartphone, Lightbulb };

function toDateKey(d) {
  if (!d) return "";
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export default function Booking() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [services, setServices] = useState([]);
  const [activeSlug, setActiveSlug] = useState(slug || "");
  const [selectedDate, setSelectedDate] = useState(null);
  const [slots, setSlots] = useState([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [time, setTime] = useState("");

  const [form, setForm] = useState({ name: "", email: "", phone: "", notes: "" });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(null);

  const activeService = useMemo(
    () => services.find((s) => s.slug === activeSlug),
    [services, activeSlug]
  );

  useEffect(() => {
    api.get("/api/services").then((r) => {
      setServices(r.data);
      if (!activeSlug && r.data.length) setActiveSlug(r.data[0].slug);
    });
  }, []); // eslint-disable-line

  useEffect(() => {
    if (!selectedDate) { setSlots([]); return; }
    setLoadingSlots(true);
    api.get(`/api/availability?date=${toDateKey(selectedDate)}`)
      .then((r) => setSlots(r.data.slots))
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
    setTime("");
  }, [selectedDate]);

  const validForm = activeSlug && selectedDate && time && form.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(form.email) && form.phone.trim().length >= 6;

  const submit = async (e) => {
    e.preventDefault();
    if (!validForm || submitting) return;
    setSubmitting(true);
    try {
      const { data } = await api.post("/api/bookings", {
        service_slug: activeSlug,
        name: form.name,
        email: form.email,
        phone: form.phone,
        notes: form.notes,
        date: toDateKey(selectedDate),
        time,
      });

      // Booking created — open Midtrans Snap
      if (!data.snap_token) {
        toast({ title: "Pembayaran tidak siap", description: "Coba lagi sebentar lagi.", variant: "destructive" });
        setSubmitting(false);
        return;
      }

      try {
        const snap = await loadMidtransSnap({
          clientKey: data.midtrans_client_key,
          isProduction: !!data.midtrans_is_production,
        });

        snap.pay(data.snap_token, {
          onSuccess: async (result) => {
            toast({ title: "Pembayaran sukses!", description: "Mengkonfirmasi booking…", variant: "success" });
            await pollBookingStatus(data.id);
          },
          onPending: async (result) => {
            toast({ title: "Menunggu pembayaran", description: "Selesaikan pembayaran dengan instruksi yang diberikan." });
            await pollBookingStatus(data.id);
          },
          onError: (result) => {
            toast({ title: "Pembayaran gagal", description: "Silakan coba lagi.", variant: "destructive" });
            setSubmitting(false);
          },
          onClose: async () => {
            // user closed the popup — fetch latest status
            const latest = await fetchBookingFresh(data.id);
            if (latest && latest.payment_status === "paid") {
              setSuccess(latest);
            } else {
              toast({ title: "Pembayaran belum selesai", description: "Slot Anda akan kami simpan selama 30 menit." });
              setSubmitting(false);
            }
          },
        });
      } catch (snapErr) {
        toast({ title: "Gagal memuat pembayaran", description: snapErr.message, variant: "destructive" });
        setSubmitting(false);
      }
    } catch (err) {
      toast({ title: "Booking gagal", description: formatApiErrorDetail(err.response?.data?.detail), variant: "destructive" });
      setSubmitting(false);
    }
  };

  const fetchBookingFresh = async (id) => {
    try {
      const r = await api.get(`/api/bookings/${id}`);
      return r.data;
    } catch {
      return null;
    }
  };

  const pollBookingStatus = async (id) => {
    // Poll up to ~12s for webhook to land
    for (let i = 0; i < 8; i++) {
      const b = await fetchBookingFresh(id);
      if (b && b.payment_status === "paid") {
        setSuccess(b);
        return;
      }
      await new Promise((r) => setTimeout(r, 1500));
    }
    // Fallback: still show success card with current state (pending) so user has a record
    const fallback = await fetchBookingFresh(id);
    if (fallback) setSuccess(fallback);
    else setSubmitting(false);
  };

  if (success) {
    const Icon = ICONS[activeService?.icon] || CalendarCheck;
    const isPaid = success.payment_status === "paid";

    // Build Google Calendar URL using booking date+time and service duration
    const buildCalUrl = () => {
      const [hh, mm] = (success.time || "09:00").split(":").map((x) => parseInt(x, 10));
      // Treat date+time as Asia/Jakarta (UTC+7) — convert to UTC for Google Calendar
      const localStart = new Date(`${success.date}T${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}:00+07:00`);
      const durMin = activeService?.duration_minutes || 60;
      const localEnd = new Date(localStart.getTime() + durMin * 60_000);
      return buildGoogleCalendarUrl({
        title: `${success.service_name} — InScale Digital`,
        description: `Booking ID: ${success.id}\nLayanan: ${success.service_name}\nNama: ${success.name}\nCatatan: ${success.notes || "-"}\n\nKami akan mengirim link Zoom melalui email konfirmasi.`,
        location: "Online via Zoom",
        startDate: localStart,
        endDate: localEnd,
      });
    };

    return (
      <>
        <Navbar />
        <section className="min-h-screen pt-32 px-4 md:px-8 bg-grid pb-16">
          <div className={`max-w-3xl mx-auto rounded-2xl border ${isPaid ? "border-accent/30" : "border-warn/30"} bg-[#121212] p-8 md:p-12 text-center`} data-testid="booking-success">
            <div
              className={`w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-6 ${
                isPaid ? "bg-accent text-bg shadow-glow" : "bg-warn/20 text-warn border border-warn/40"
              }`}
            >
              {isPaid ? <Check size={28} strokeWidth={3} /> : <CreditCard size={26} strokeWidth={2.5} />}
            </div>
            <h1 className="font-display font-bold text-3xl md:text-4xl mb-3">
              {isPaid ? "Pembayaran terkonfirmasi!" : "Slot Anda terkunci 30 menit"}
            </h1>
            <p className="text-textS mb-8 max-w-xl mx-auto">
              {isPaid ? (
                <>Email konfirmasi & link Zoom dikirim ke <span className="text-white font-semibold">{success.email}</span> dalam &lt; 24 jam.</>
              ) : (
                <>Selesaikan pembayaran sebelum slot dilepas. Setelah berhasil bayar, status booking otomatis berubah ke "terkonfirmasi".</>
              )}
            </p>

            <div className="grid sm:grid-cols-2 gap-3 text-left mb-8">
              <Detail label="Layanan" value={success.service_name} icon={Icon} />
              <Detail label="ID Booking" value={success.id.slice(0, 8).toUpperCase()} mono />
              <Detail label="Tanggal" value={fmtDateID(success.date)} />
              <Detail label="Waktu" value={success.time + " WIB"} mono />
              <Detail label="Status" value={success.status === "confirmed" ? "Terkonfirmasi" : "Menunggu"} />
              <Detail label="Pembayaran" value={isPaid ? "Lunas" : "Pending"} mono />
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center flex-wrap">
              {isPaid && (
                <a
                  href={buildCalUrl()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 bg-accent hover:bg-accentHover text-bg font-bold px-5 py-3 rounded-xl transition-transform hover:scale-[1.02] active:scale-95 shadow-glow"
                  data-testid="success-add-gcal"
                >
                  <CalendarPlus size={16} strokeWidth={2.5} /> Tambahkan ke Google Calendar
                </a>
              )}
              <Link to="/" className="px-5 py-3 rounded-xl border border-white/15 hover:border-white/40 font-semibold inline-flex items-center justify-center" data-testid="success-home">
                ← Kembali ke Beranda
              </Link>
              <button
                type="button"
                onClick={() => { setSuccess(null); setSelectedDate(null); setTime(""); setForm({name:"",email:"",phone:"",notes:""}); setSubmitting(false); }}
                className="px-5 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 font-semibold"
                data-testid="success-book-another"
              >
                Booking Lagi
              </button>
            </div>
          </div>
        </section>
        <Footer />
      </>
    );
  }

  return (
    <>
      <Navbar />
      <section className="min-h-screen pt-28 px-4 md:px-8 pb-20 bg-grid">
        <div className="max-w-7xl mx-auto">
          <Link to="/" className="inline-flex items-center gap-2 text-textS hover:text-white text-sm mb-6" data-testid="booking-back">
            <ArrowLeft size={14} /> Beranda
          </Link>

          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
            <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-2">// Jadwalkan Sesi</div>
            <h1 className="font-display font-black text-4xl md:text-6xl tracking-tighter leading-[0.95] mb-4">
              Pilih waktu yang <span className="text-accent">cocok</span> untuk Anda.
            </h1>
            <p className="text-textS text-lg max-w-2xl mb-10">
              Kalender ini realtime — slot yang Anda lihat memang masih kosong saat halaman ini dibuka.
            </p>
          </motion.div>

          {/* Service selector */}
          <div className="grid md:grid-cols-4 gap-3 mb-10">
            {services.map((s) => {
              const I = ICONS[s.icon] || Globe;
              const active = s.slug === activeSlug;
              return (
                <button
                  key={s.slug}
                  type="button"
                  onClick={() => setActiveSlug(s.slug)}
                  className={`text-left rounded-2xl border p-4 transition-all ${active ? "border-accent bg-[rgba(209,255,77,0.06)] shadow-glow" : "border-white/10 bg-[#121212] hover:border-white/30"}`}
                  data-testid={`select-service-${s.slug}`}
                >
                  <div className="flex items-center gap-3 mb-3">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center"
                      style={{ background: `${s.color}18`, color: s.color }}
                    >
                      <I size={18} />
                    </div>
                    {active && <span className="text-[10px] font-mono uppercase tracking-[0.2em] text-accent">Dipilih</span>}
                  </div>
                  <div className="font-display font-bold text-lg leading-tight mb-1">{s.name}</div>
                  <div className="text-xs text-textS font-mono">{s.duration_minutes} menit</div>
                  <div className="text-sm font-bold mt-2">{formatIDR(s.price_idr)}</div>
                </button>
              );
            })}
          </div>

          {/* Calendar + Form grid */}
          <div className="grid md:grid-cols-12 gap-5 md:gap-6">
            <div className="md:col-span-5">
              <Calendar selectedDate={selectedDate} onSelect={setSelectedDate} />

              <div className="mt-5 rounded-2xl border border-white/10 bg-[#121212] p-5">
                <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-textS mb-3">
                  Slot Tersedia {selectedDate && `· ${fmtDateID(toDateKey(selectedDate))}`}
                </div>
                <TimeSlots slots={slots} selected={time} onSelect={setTime} loading={loadingSlots} />
              </div>
            </div>

            <form onSubmit={submit} className="md:col-span-7 rounded-2xl border border-white/10 bg-[#121212] p-6 md:p-8 space-y-5" data-testid="booking-form">
              <div>
                <h2 className="font-display font-bold text-2xl md:text-3xl mb-1">Detail Anda</h2>
                <p className="text-textS text-sm">Kami pakai data ini untuk konfirmasi & kirim link Zoom.</p>
              </div>

              <div className="grid sm:grid-cols-2 gap-4">
                <Field label="Nama Lengkap" required>
                  <input
                    className="input-base"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="cth: Budi Santoso"
                    data-testid="input-name"
                    required
                  />
                </Field>
                <Field label="Email" required>
                  <input
                    type="email"
                    className="input-base"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="cth: budi@contoh.com"
                    data-testid="input-email"
                    required
                  />
                </Field>
                <Field label="No. WhatsApp" required>
                  <input
                    className="input-base"
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    placeholder="cth: 081234567890"
                    data-testid="input-phone"
                    required
                  />
                </Field>
                <Field label="Layanan">
                  <input
                    className="input-base !cursor-not-allowed"
                    value={activeService?.name || ""}
                    readOnly
                    data-testid="input-service"
                  />
                </Field>
              </div>

              <Field label="Catatan (opsional)">
                <textarea
                  className="input-base min-h-[110px]"
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="Ceritakan kebutuhan Anda secara singkat…"
                  data-testid="input-notes"
                />
              </Field>

              <div className="rounded-xl border border-white/5 bg-bg/40 p-4 text-sm">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-textS mb-1">Ringkasan</div>
                    <div className="font-semibold">
                      {activeService?.name || "—"}
                    </div>
                    <div className="text-textS text-xs mt-1">
                      {selectedDate ? fmtDateID(toDateKey(selectedDate)) : "Pilih tanggal"} · {time || "Pilih waktu"}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-textS">Total</div>
                    <div className="font-display text-xl font-bold">{activeService ? formatIDR(activeService.price_idr) : "—"}</div>
                  </div>
                </div>
              </div>

              <button
                type="submit"
                disabled={!validForm || submitting}
                className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accentHover disabled:bg-white/10 disabled:text-textS disabled:cursor-not-allowed text-bg font-bold px-6 py-4 rounded-xl text-base transition-transform hover:scale-[1.01] active:scale-95"
                data-testid="booking-submit-button"
              >
                <CreditCard size={18} strokeWidth={2.5} />
                {submitting ? "Memproses…" : "Lanjut ke Pembayaran"}
              </button>

              {!validForm && (
                <p className="text-textS text-xs text-center" data-testid="booking-hint">
                  Lengkapi: layanan, tanggal, waktu, nama, email & WhatsApp.
                </p>
              )}
              <p className="text-[11px] font-mono uppercase tracking-[0.18em] text-textS text-center pt-1">
                Pembayaran aman via Midtrans · QRIS · GoPay · BCA VA · Kartu Kredit
              </p>
            </form>
          </div>
        </div>
      </section>
      <Footer />
    </>
  );
}

function Field({ label, children, required }) {
  return (
    <label className="block">
      <span className="block text-[11px] font-mono uppercase tracking-[0.18em] text-textS mb-2">
        {label} {required && <span className="text-accent">*</span>}
      </span>
      {children}
    </label>
  );
}

function Detail({ label, value, mono, icon: Icon }) {
  return (
    <div className="rounded-xl border border-white/10 bg-bg/40 p-4">
      <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-textS flex items-center gap-2">
        {Icon && <Icon size={12} className="text-accent" />} {label}
      </div>
      <div className={`mt-1.5 font-semibold ${mono ? "font-mono" : ""}`}>{value}</div>
    </div>
  );
}
