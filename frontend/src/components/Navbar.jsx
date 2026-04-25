import React from "react";
import { Link } from "react-router-dom";
import { Calendar, Sparkles } from "lucide-react";

export default function Navbar({ active = "home" }) {
  return (
    <header className="fixed top-0 inset-x-0 z-40 px-4 md:px-8 py-4">
      <div
        className="max-w-7xl mx-auto flex items-center justify-between rounded-2xl border border-white/10 bg-[#0A0A0A]/70 backdrop-blur-xl px-4 md:px-6 py-3"
        data-testid="navbar"
      >
        <Link to="/" className="flex items-center gap-2.5 group" data-testid="nav-logo">
          <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-bg shadow-glow">
            <Sparkles size={16} strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-lg tracking-tight">
            InScale<span className="text-accent">.</span>Digital
          </span>
        </Link>

        <nav className="hidden md:flex items-center gap-8 text-sm font-medium text-textS">
          <a href="/#layanan" className={`hover:text-white transition-colors ${active === "services" ? "text-white" : ""}`} data-testid="nav-services">
            Layanan
          </a>
          <a href="/#cara-kerja" className="hover:text-white transition-colors" data-testid="nav-how">
            Cara Kerja
          </a>
          <a href="/#testimoni" className="hover:text-white transition-colors" data-testid="nav-testi">
            Testimoni
          </a>
          <a href="/#faq" className="hover:text-white transition-colors" data-testid="nav-faq">
            FAQ
          </a>
        </nav>

        <Link
          to="/booking"
          className="inline-flex items-center gap-2 bg-accent hover:bg-accentHover text-bg font-bold px-4 py-2 rounded-xl transition-transform hover:scale-[1.02] active:scale-95"
          data-testid="nav-cta-book"
        >
          <Calendar size={16} strokeWidth={2.5} />
          Jadwalkan
        </Link>
      </div>
    </header>
  );
}
