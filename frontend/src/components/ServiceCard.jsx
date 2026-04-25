import React, { useRef } from "react";
import { motion, useMotionValue, useTransform } from "framer-motion";
import { Link } from "react-router-dom";
import { ArrowUpRight, ShoppingCart, Globe, Smartphone, Lightbulb } from "lucide-react";
import { formatIDR } from "../lib/api";

const ICONS = { ShoppingCart, Globe, Smartphone, Lightbulb };

export default function ServiceCard({ service, span = 6, index = 0 }) {
  const Icon = ICONS[service.icon] || Globe;
  const ref = useRef(null);

  const mx = useMotionValue(0);
  const my = useMotionValue(0);
  const rotateX = useTransform(my, [-50, 50], [6, -6]);
  const rotateY = useTransform(mx, [-50, 50], [-6, 6]);

  const handleMove = (e) => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    mx.set(e.clientX - rect.left - rect.width / 2);
    my.set(e.clientY - rect.top - rect.height / 2);
  };
  const handleLeave = () => { mx.set(0); my.set(0); };

  return (
    <motion.div
      ref={ref}
      onMouseMove={handleMove}
      onMouseLeave={handleLeave}
      style={{ rotateX, rotateY, transformPerspective: 1000 }}
      initial={{ opacity: 0, y: 30 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.2 }}
      transition={{ duration: 0.6, delay: index * 0.08, ease: [0.22, 1, 0.36, 1] }}
      className={`md:col-span-${span} relative card-beam rounded-2xl border border-white/10 bg-[#121212] p-6 md:p-7 transition-all duration-300 hover:border-accent/40`}
      data-testid={`service-card-${service.slug}`}
    >
      <div
        className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
        style={{ background: `${service.color}18`, color: service.color, boxShadow: `0 0 24px ${service.color}25` }}
      >
        <Icon size={22} strokeWidth={2} />
      </div>

      <div className="text-[11px] font-mono uppercase tracking-[0.2em] text-textS mb-2">
        {service.duration_minutes} menit · sesi privat
      </div>

      <h3 className="font-display text-2xl md:text-[1.65rem] font-bold leading-tight mb-3">
        {service.name}
      </h3>
      <p className="text-textS leading-relaxed mb-5 text-sm md:text-base">
        {service.short_desc}
      </p>

      <ul className="space-y-1.5 mb-6">
        {service.bullets.slice(0, 3).map((b, i) => (
          <li key={i} className="text-[13px] text-textS/90 flex items-start gap-2">
            <span className="text-accent mt-1">›</span>
            <span>{b}</span>
          </li>
        ))}
      </ul>

      <div className="flex items-end justify-between pt-5 border-t border-white/5">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-textS">Mulai dari</div>
          <div className="font-display text-xl font-bold mt-1" data-testid={`service-price-${service.slug}`}>
            {formatIDR(service.price_idr)}
          </div>
        </div>
        <Link
          to={`/booking/${service.slug}`}
          className="inline-flex items-center gap-1.5 bg-accent hover:bg-accentHover text-bg font-bold px-4 py-2.5 rounded-xl text-sm transition-transform hover:scale-[1.03] active:scale-95"
          data-testid={`service-book-${service.slug}`}
        >
          Jadwalkan <ArrowUpRight size={15} strokeWidth={2.5} />
        </Link>
      </div>
    </motion.div>
  );
}
