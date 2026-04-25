import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowUpRight, CalendarCheck, Clock4, Cpu, Layers3, ShieldCheck, Sparkles, Star, Zap, Globe, Smartphone, ShoppingCart, Lightbulb } from "lucide-react";
import Hero3D from "../components/Hero3D";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import ServiceCard from "../components/ServiceCard";
import { api } from "../lib/api";

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: (i = 0) => ({ opacity: 1, y: 0, transition: { duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] } }),
};

export default function Landing() {
  const [services, setServices] = useState([]);

  useEffect(() => {
    api.get("/api/services").then((r) => setServices(r.data)).catch(() => setServices([]));
  }, []);

  return (
    <>
      <Navbar active="home" />
      <Hero />
      <ClientStrip />
      <ServicesSection services={services} />
      <HowItWorks />
      <ScheduleShowcase />
      <Testimonials />
      <FAQ />
      <FinalCTA />
      <Footer />
    </>
  );
}

/* ------------- HERO ------------- */
function Hero() {
  return (
    <section className="relative min-h-[100vh] overflow-hidden bg-grid">
      <Hero3D />
      <div className="absolute inset-0 bg-gradient-to-b from-bg/40 via-bg/40 to-bg pointer-events-none z-[1]" />

      <div className="relative z-10 max-w-7xl mx-auto px-4 md:px-8 pt-36 md:pt-44 pb-24">
        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={0}
          className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 backdrop-blur-md px-3.5 py-1.5 mb-7"
          data-testid="hero-badge"
        >
          <span className="w-2 h-2 rounded-full bg-accent glow-dot" />
          <span className="text-xs font-mono uppercase tracking-[0.18em] text-textS">Tersedia · Slot minggu ini terbuka</span>
        </motion.div>

        <motion.h1
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={1}
          className="font-display font-black text-[3.4rem] sm:text-7xl md:text-[6rem] leading-[0.92] tracking-tighter max-w-5xl"
          data-testid="hero-title"
        >
          Jadwalkan jasa
          <br />
          <span className="text-accent">digital</span> Anda —
          <br />
          dalam satu klik.
        </motion.h1>

        <motion.p
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={2}
          className="mt-7 text-lg md:text-xl text-textS max-w-2xl leading-relaxed"
        >
          Install OpenCart via Zoom, pembuatan website, aplikasi mobile, dan konsultasi digital —
          pilih waktu yang cocok di kalender realtime kami.
        </motion.p>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={3}
          className="mt-9 flex flex-col sm:flex-row items-start sm:items-center gap-3"
        >
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accentHover text-bg font-bold px-6 py-3.5 rounded-xl transition-transform hover:scale-[1.03] active:scale-95 shadow-glow"
            data-testid="hero-cta-primary"
          >
            <CalendarCheck size={18} strokeWidth={2.5} /> Buka Jadwal Sekarang
          </Link>
          <a
            href="#layanan"
            className="inline-flex items-center gap-2 border border-white/15 hover:border-white/40 px-6 py-3.5 rounded-xl font-semibold transition-colors"
            data-testid="hero-cta-secondary"
          >
            Lihat Layanan <ArrowUpRight size={16} />
          </a>
        </motion.div>

        <motion.div
          variants={fadeUp}
          initial="hidden"
          animate="show"
          custom={4}
          className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-4 max-w-3xl"
        >
          {[
            { k: "120+", v: "Sesi Selesai" },
            { k: "4.9★", v: "Rating Klien" },
            { k: "< 24j", v: "Konfirmasi" },
            { k: "100%", v: "Remote-Ready" },
          ].map((s) => (
            <div key={s.v} className="rounded-xl border border-white/10 bg-[#121212]/70 backdrop-blur p-4">
              <div className="font-display font-bold text-2xl md:text-3xl text-accent">{s.k}</div>
              <div className="text-[11px] font-mono uppercase tracking-[0.18em] text-textS mt-1">{s.v}</div>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
}

/* ------------- CLIENT STRIP (marquee) ------------- */
function ClientStrip() {
  const items = [
    "OpenCart", "WooCommerce", "Shopify", "Midtrans", "Xendit", "Vercel",
    "MongoDB", "FastAPI", "React Native", "Flutter", "Stripe", "AWS",
  ];
  return (
    <section className="py-10 border-y border-white/5 overflow-hidden bg-[#0c0c0c]" data-testid="client-strip">
      <div className="text-center text-[11px] font-mono uppercase tracking-[0.25em] text-textS mb-5">
        Stack & Mitra Implementasi Kami
      </div>
      <div className="overflow-hidden">
        <div className="marquee-track gap-12 whitespace-nowrap text-2xl md:text-3xl font-display font-semibold text-textS/60">
          {[...items, ...items].map((t, i) => (
            <span key={i} className="inline-flex items-center gap-12">
              {t}
              <span className="w-1.5 h-1.5 rounded-full bg-accent/70" />
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------- SERVICES ------------- */
function ServicesSection({ services }) {
  return (
    <section id="layanan" className="relative py-24 md:py-32 px-4 md:px-8">
      <div className="max-w-7xl mx-auto">
        <SectionHeader
          tag="// Layanan"
          title="Empat menu, satu jadwal."
          subtitle="Pilih layanan yang Anda butuhkan, lihat slot yang tersedia, dan booking dalam < 60 detik."
        />

        <div className="grid grid-cols-1 md:grid-cols-12 gap-5 md:gap-6 mt-14">
          {services.map((s, i) => (
            <ServiceCard
              key={s.id}
              service={s}
              index={i}
              span={i === 0 || i === 3 ? 6 : 6}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------- HOW IT WORKS ------------- */
function HowItWorks() {
  const steps = [
    { icon: Layers3, title: "Pilih Layanan", desc: "Tentukan kebutuhan Anda — install OpenCart, website, aplikasi, atau konsultasi." },
    { icon: CalendarCheck, title: "Pilih Tanggal & Jam", desc: "Kalender realtime menampilkan slot yang masih tersedia. Pilih yang paling cocok." },
    { icon: ShieldCheck, title: "Konfirmasi", desc: "Tim kami konfirmasi via email dalam < 24 jam dan kirim link sesi Zoom." },
    { icon: Zap, title: "Eksekusi", desc: "Sesi berjalan sesuai jadwal. Anda dapat rekaman, notulensi, dan support follow-up." },
  ];
  return (
    <section id="cara-kerja" className="relative py-24 md:py-32 px-4 md:px-8 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <SectionHeader tag="// Cara Kerja" title="Empat langkah, tanpa drama." />
        <div className="mt-14 grid md:grid-cols-4 gap-4">
          {steps.map((s, i) => (
            <motion.div
              key={s.title}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="relative rounded-2xl border border-white/10 bg-[#121212] p-6"
              data-testid={`how-step-${i + 1}`}
            >
              <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-4">
                Langkah {String(i + 1).padStart(2, "0")}
              </div>
              <s.icon size={28} className="text-white mb-4" strokeWidth={1.5} />
              <h3 className="font-display font-bold text-xl mb-2">{s.title}</h3>
              <p className="text-textS text-sm leading-relaxed">{s.desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------- SCHEDULE SHOWCASE ------------- */
function ScheduleShowcase() {
  return (
    <section className="relative py-24 md:py-32 px-4 md:px-8 border-t border-white/5 overflow-hidden">
      <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-10 items-center">
        <motion.div
          initial={{ opacity: 0, x: -24 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.7 }}
          className="md:col-span-6"
        >
          <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-textS mb-3">
            // Kalender Realtime
          </div>
          <h2 className="font-display font-bold text-4xl md:text-5xl leading-[1.05] tracking-tight mb-5">
            Lihat slot yang
            <br /><span className="text-accent">tersedia</span> —
            <br /> tanpa nunggu balasan.
          </h2>
          <p className="text-textS text-lg leading-relaxed mb-7">
            Setiap slot diperbarui live. Yang terisi langsung hilang dari pilihan,
            jadi Anda hanya melihat waktu yang benar-benar bisa dibooking.
          </p>
          <Link
            to="/booking"
            className="inline-flex items-center gap-2 bg-accent hover:bg-accentHover text-bg font-bold px-5 py-3 rounded-xl transition-transform hover:scale-[1.02] active:scale-95 shadow-glow"
            data-testid="showcase-cta"
          >
            Coba Kalender <ArrowUpRight size={16} strokeWidth={2.5} />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          whileInView={{ opacity: 1, scale: 1 }}
          viewport={{ once: true, amount: 0.3 }}
          transition={{ duration: 0.8 }}
          className="md:col-span-6 rounded-2xl border border-white/10 bg-[#121212] p-6 md:p-7"
        >
          <div className="flex items-center justify-between mb-5">
            <div className="font-display font-semibold">Februari <span className="text-accent">2026</span></div>
            <div className="flex items-center gap-2 text-[11px] font-mono uppercase tracking-[0.2em] text-textS">
              <span className="w-1.5 h-1.5 rounded-full bg-accent glow-dot" /> Live
            </div>
          </div>
          <div className="grid grid-cols-7 gap-2 mb-3 text-[11px] font-mono uppercase tracking-[0.18em] text-textS">
            {["Min","Sen","Sel","Rab","Kam","Jum","Sab"].map((d) => <div key={d} className="text-center">{d}</div>)}
          </div>
          <div className="grid grid-cols-7 gap-2">
            {Array.from({ length: 35 }).map((_, i) => {
              const num = i - 5;
              const valid = num >= 1 && num <= 28;
              const sun = (i % 7) === 0;
              const available = valid && !sun && num % 3 !== 0;
              const selected = num === 14;
              return (
                <div
                  key={i}
                  className={`cal-day ${!valid ? "cal-other-month" : ""} ${!available && valid ? "cal-disabled" : ""} ${selected ? "cal-selected" : ""}`}
                >
                  {valid ? num : ""}
                </div>
              );
            })}
          </div>
          <div className="grid grid-cols-4 gap-2 mt-6">
            {["09:00","10:00","11:00","13:00","14:00","15:00","16:00","19:00"].map((t, i) => {
              const used = [1, 4].includes(i);
              const sel = i === 5;
              return (
                <div key={t} className={`slot-chip ${used ? "disabled" : ""} ${sel ? "selected" : ""}`}>{t}</div>
              );
            })}
          </div>
        </motion.div>
      </div>
    </section>
  );
}

/* ------------- TESTIMONIALS ------------- */
function Testimonials() {
  const items = [
    { name: "Rina Wijaya", role: "Owner, Toko Sambal Bunda", text: "Setup OpenCart-nya cuma 90 menit via Zoom. Tokonya udah live hari itu juga, lengkap dengan Midtrans!" },
    { name: "Andi Pratama", role: "Founder, Kopi Senja", text: "Tim InScale bantu desain ulang website kami — performa Lighthouse jadi 98. Gokil." },
    { name: "Mei-Lin Tan", role: "PM, Halokes Health", text: "Konsultasi 60 menit-nya bener-bener nyelametin roadmap MVP kami. Action items langsung jalan." },
  ];
  return (
    <section id="testimoni" className="py-24 md:py-32 px-4 md:px-8 border-t border-white/5">
      <div className="max-w-7xl mx-auto">
        <SectionHeader tag="// Testimoni" title="Apa kata mereka." />
        <div className="grid md:grid-cols-3 gap-5 mt-14">
          {items.map((t, i) => (
            <motion.div
              key={t.name}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, amount: 0.3 }}
              transition={{ duration: 0.6, delay: i * 0.08 }}
              className="rounded-2xl border border-white/10 bg-[#121212] p-6 md:p-7"
              data-testid={`testimoni-${i}`}
            >
              <div className="flex items-center gap-1 mb-4 text-accent">
                {Array.from({ length: 5 }).map((_, k) => <Star key={k} size={14} fill="#D1FF4D" strokeWidth={0} />)}
              </div>
              <p className="text-base leading-relaxed mb-6">“{t.text}”</p>
              <div className="pt-5 border-t border-white/5">
                <div className="font-semibold">{t.name}</div>
                <div className="text-textS text-xs font-mono uppercase tracking-[0.18em] mt-1">{t.role}</div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------- FAQ ------------- */
function FAQ() {
  const [open, setOpen] = useState(0);
  const items = [
    { q: "Apakah saya dapat link Zoom otomatis?", a: "Ya. Setelah booking dikonfirmasi tim kami (< 24 jam), Anda akan menerima email berisi link Zoom dan agenda sesi." },
    { q: "Bisa reschedule kalau ada urusan mendadak?", a: "Tentu — minimal 12 jam sebelum sesi. Hubungi kami via email atau WhatsApp, kami pindahkan tanpa biaya." },
    { q: "Pembayarannya bagaimana?", a: "Booking ini menyimpan jadwal terlebih dulu. Konfirmasi dan instruksi pembayaran dikirim via email setelah slot Anda dikunci." },
    { q: "Apakah saya dapat rekaman sesi?", a: "Untuk paket Konsultasi & Install, rekaman sesi Zoom dikirim dalam waktu 1×24 jam pasca-sesi." },
  ];
  return (
    <section id="faq" className="py-24 md:py-32 px-4 md:px-8 border-t border-white/5">
      <div className="max-w-4xl mx-auto">
        <SectionHeader tag="// FAQ" title="Pertanyaan yang sering muncul." centered={false} />
        <div className="mt-12 divide-y divide-white/5 border-y border-white/5">
          {items.map((it, i) => (
            <button
              key={i}
              type="button"
              onClick={() => setOpen(open === i ? -1 : i)}
              className="w-full text-left py-5 flex items-start gap-5 group"
              data-testid={`faq-item-${i}`}
            >
              <span className="font-mono text-xs text-textS pt-1">0{i + 1}</span>
              <div className="flex-1">
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display font-semibold text-lg md:text-xl group-hover:text-accent transition-colors">{it.q}</span>
                  <span className={`text-accent text-2xl transition-transform ${open === i ? "rotate-45" : ""}`}>+</span>
                </div>
                {open === i && <p className="text-textS mt-3 text-sm md:text-base leading-relaxed">{it.a}</p>}
              </div>
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ------------- FINAL CTA ------------- */
function FinalCTA() {
  return (
    <section className="relative py-24 md:py-32 px-4 md:px-8 border-t border-white/5 overflow-hidden">
      <div className="absolute inset-0 bg-grid opacity-50" />
      <div className="relative max-w-5xl mx-auto rounded-3xl border border-accent/30 bg-gradient-to-br from-[#121212] via-[#121212] to-[rgba(209,255,77,0.06)] p-10 md:p-16 text-center">
        <Sparkles className="text-accent mx-auto mb-5" size={32} />
        <h2 className="font-display font-black text-4xl md:text-5xl leading-tight tracking-tighter mb-5">
          Siap meluncurkan? <br /> <span className="text-accent">Ambil slot Anda.</span>
        </h2>
        <p className="text-textS text-lg max-w-2xl mx-auto mb-8 leading-relaxed">
          Kalender realtime + 4 layanan inti + tim yang sudah handle 120+ proyek digital UMKM Indonesia.
        </p>
        <Link
          to="/booking"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accentHover text-bg font-bold px-7 py-4 rounded-xl text-lg transition-transform hover:scale-[1.03] active:scale-95 shadow-glow"
          data-testid="final-cta"
        >
          Buka Jadwal Sekarang <ArrowUpRight size={18} strokeWidth={2.5} />
        </Link>
      </div>
    </section>
  );
}

/* ------------- helpers ------------- */
function SectionHeader({ tag, title, subtitle, centered = false }) {
  return (
    <div className={centered ? "text-center max-w-2xl mx-auto" : "max-w-3xl"}>
      <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-3">{tag}</div>
      <h2 className="font-display font-bold text-4xl md:text-5xl tracking-tighter leading-[1.05]">
        {title}
      </h2>
      {subtitle && <p className="text-textS text-lg leading-relaxed mt-5">{subtitle}</p>}
    </div>
  );
}
