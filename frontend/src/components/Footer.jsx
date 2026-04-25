import React from "react";
import { Github, Instagram, Linkedin, Mail, MapPin, Sparkles } from "lucide-react";

export default function Footer() {
  return (
    <footer className="relative px-4 md:px-8 pt-16 pb-8 border-t border-white/5" data-testid="footer">
      <div className="max-w-7xl mx-auto grid md:grid-cols-12 gap-10">
        <div className="md:col-span-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-bg">
              <Sparkles size={18} strokeWidth={2.5} />
            </div>
            <span className="font-display font-bold text-xl">InScale<span className="text-accent">.</span>Digital</span>
          </div>
          <p className="text-textS leading-relaxed max-w-md">
            Studio digital independen — bantu UMKM & startup Indonesia meluncurkan toko online,
            website, dan aplikasi mobile dengan jadwal yang fleksibel.
          </p>
          <div className="flex items-center gap-3 mt-6">
            <a href="#" data-testid="social-instagram" className="w-10 h-10 rounded-lg border border-white/10 hover:border-accent hover:text-accent flex items-center justify-center transition-all"><Instagram size={16} /></a>
            <a href="#" data-testid="social-github" className="w-10 h-10 rounded-lg border border-white/10 hover:border-accent hover:text-accent flex items-center justify-center transition-all"><Github size={16} /></a>
            <a href="#" data-testid="social-linkedin" className="w-10 h-10 rounded-lg border border-white/10 hover:border-accent hover:text-accent flex items-center justify-center transition-all"><Linkedin size={16} /></a>
          </div>
        </div>

        <div className="md:col-span-3">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-textS mb-4">Layanan</div>
          <ul className="space-y-2.5 text-sm">
            <li><a href="/booking/install-opencart-zoom" className="hover:text-accent transition-colors">Install OpenCart via Zoom</a></li>
            <li><a href="/booking/website-development" className="hover:text-accent transition-colors">Pembuatan Website</a></li>
            <li><a href="/booking/mobile-app-development" className="hover:text-accent transition-colors">Aplikasi Mobile</a></li>
            <li><a href="/booking/digital-consulting" className="hover:text-accent transition-colors">Konsultasi Digital</a></li>
          </ul>
        </div>

        <div className="md:col-span-4">
          <div className="text-xs font-mono uppercase tracking-[0.2em] text-textS mb-4">Hubungi</div>
          <ul className="space-y-3 text-sm text-textS">
            <li className="flex items-start gap-2.5"><Mail size={16} className="mt-0.5 text-accent" /> halo@inscaledigital.id</li>
            <li className="flex items-start gap-2.5"><MapPin size={16} className="mt-0.5 text-accent" /> Jakarta — remote di seluruh Indonesia</li>
          </ul>
          <a href="/admin/login" className="inline-block mt-6 text-xs font-mono uppercase tracking-[0.2em] text-textS hover:text-accent" data-testid="footer-admin-link">
            Login Admin →
          </a>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-10 mt-10 border-t border-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs font-mono uppercase tracking-[0.18em] text-textS">
        <div>© 2026 InScale Digital — Dibuat dengan teliti di Indonesia.</div>
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-accent glow-dot" /> Sistem online — siap menerima jadwal
        </div>
      </div>
    </footer>
  );
}
