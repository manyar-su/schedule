import React, { useEffect, useState, useMemo } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { api, formatApiErrorDetail, formatIDR, fmtDateID } from "../lib/api";
import { useToast } from "../components/ui/Toaster";
import {
  LogOut, RefreshCcw, Search, Calendar as CalendarIcon, Trash2, CheckCircle2,
  Clock, XCircle, BadgeCheck, Sparkles, Filter, Mail, Phone
} from "lucide-react";

const STATUSES = [
  { value: "all", label: "Semua" },
  { value: "pending", label: "Pending" },
  { value: "confirmed", label: "Dikonfirmasi" },
  { value: "completed", label: "Selesai" },
  { value: "cancelled", label: "Dibatalkan" },
];

function StatusBadge({ status }) {
  const map = {
    pending: { c: "bg-warn/10 text-warn border-warn/30", t: "Pending" },
    confirmed: { c: "bg-cyan2/10 text-cyan2 border-cyan2/30", t: "Dikonfirmasi" },
    completed: { c: "bg-accent/15 text-accent border-accent/30", t: "Selesai" },
    cancelled: { c: "bg-danger/10 text-[#FF8FA9] border-danger/30", t: "Dibatalkan" },
  };
  const v = map[status] || map.pending;
  return <span className={`inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-[0.18em] border rounded-full px-2 py-1 ${v.c}`}>{v.t}</span>;
}

export default function AdminDashboard() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();

  const [bookings, setBookings] = useState([]);
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState("all");
  const [q, setQ] = useState("");

  const fetchData = async () => {
    setLoading(true);
    try {
      const [bRes, sRes] = await Promise.all([
        api.get("/api/admin/bookings"),
        api.get("/api/admin/stats"),
      ]);
      setBookings(bRes.data);
      setStats(sRes.data);
    } catch (err) {
      toast({ title: "Gagal memuat data", description: formatApiErrorDetail(err.response?.data?.detail), variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchData(); }, []); // eslint-disable-line

  const filtered = useMemo(() => {
    return bookings
      .filter((b) => (filter === "all" ? true : b.status === filter))
      .filter((b) => {
        if (!q.trim()) return true;
        const s = q.toLowerCase();
        return [b.name, b.email, b.phone, b.service_name, b.id].join(" ").toLowerCase().includes(s);
      });
  }, [bookings, filter, q]);

  const updateStatus = async (id, status) => {
    try {
      await api.patch(`/api/admin/bookings/${id}`, { status });
      toast({ title: "Status diperbarui", variant: "success" });
      fetchData();
    } catch (err) {
      toast({ title: "Gagal memperbarui", description: formatApiErrorDetail(err.response?.data?.detail), variant: "destructive" });
    }
  };

  const remove = async (id) => {
    if (!window.confirm("Hapus booking ini?")) return;
    try {
      await api.delete(`/api/admin/bookings/${id}`);
      toast({ title: "Booking dihapus", variant: "success" });
      fetchData();
    } catch (err) {
      toast({ title: "Gagal menghapus", description: formatApiErrorDetail(err.response?.data?.detail), variant: "destructive" });
    }
  };

  const handleLogout = async () => {
    await logout();
    navigate("/admin/login", { replace: true });
  };

  return (
    <div className="min-h-screen bg-bg" data-testid="admin-dashboard">
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/80 backdrop-blur-xl border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 md:px-8 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-accent flex items-center justify-center text-bg">
              <Sparkles size={15} strokeWidth={2.5} />
            </div>
            <div>
              <div className="font-display font-bold text-base leading-none">InScale<span className="text-accent">.</span>Digital</div>
              <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-textS mt-1">Admin Console</div>
            </div>
          </Link>
          <div className="flex items-center gap-3">
            <button onClick={fetchData} className="hidden sm:inline-flex items-center gap-1.5 text-sm text-textS hover:text-white border border-white/10 hover:border-white/30 px-3 py-2 rounded-lg" data-testid="admin-refresh">
              <RefreshCcw size={14} /> Refresh
            </button>
            <div className="text-right hidden md:block">
              <div className="text-xs text-textS">Login sebagai</div>
              <div className="text-sm font-semibold">{user?.email}</div>
            </div>
            <button onClick={handleLogout} className="inline-flex items-center gap-1.5 text-sm bg-white/5 hover:bg-white/10 border border-white/10 px-3 py-2 rounded-lg" data-testid="admin-logout">
              <LogOut size={14} /> Keluar
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 md:px-8 py-8 md:py-10">
        <div className="mb-8">
          <h1 className="font-display font-black text-3xl md:text-5xl tracking-tighter">Booking Hari Ini & Mendatang.</h1>
          <p className="text-textS mt-2">Kelola seluruh jadwal layanan digital di satu tempat.</p>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 mb-8" data-testid="admin-stats">
          <StatCard label="Total" value={stats?.total ?? "—"} />
          <StatCard label="Hari Ini" value={stats?.today ?? "—"} accent />
          <StatCard label="Pending" value={stats?.pending ?? "—"} />
          <StatCard label="Dikonfirmasi" value={stats?.confirmed ?? "—"} />
          <StatCard label="Pendapatan" value={stats ? formatIDR(stats.revenue_idr) : "—"} small />
        </div>

        {/* Filters */}
        <div className="rounded-2xl border border-white/10 bg-[#111] p-4 md:p-5 mb-5">
          <div className="flex flex-col md:flex-row md:items-center gap-3">
            <div className="flex items-center gap-2 text-textS">
              <Filter size={14} />
              <span className="text-[11px] font-mono uppercase tracking-[0.18em]">Filter</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {STATUSES.map((s) => (
                <button
                  key={s.value}
                  onClick={() => setFilter(s.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono uppercase tracking-[0.15em] border transition-all ${
                    filter === s.value
                      ? "bg-accent text-bg border-accent"
                      : "border-white/10 text-textS hover:border-white/30"
                  }`}
                  data-testid={`filter-${s.value}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
            <div className="md:ml-auto relative w-full md:w-72">
              <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-textS" />
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Cari nama, email, layanan…"
                className="input-base !pl-9"
                data-testid="admin-search"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl border border-white/10 bg-[#111] overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm" data-testid="admin-table">
              <thead className="text-[10px] font-mono uppercase tracking-[0.2em] text-textS bg-white/[0.03]">
                <tr>
                  <th className="text-left px-5 py-3.5">Klien</th>
                  <th className="text-left px-5 py-3.5">Layanan</th>
                  <th className="text-left px-5 py-3.5">Jadwal</th>
                  <th className="text-left px-5 py-3.5">Status</th>
                  <th className="text-right px-5 py-3.5">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {loading && (
                  <tr><td colSpan={5} className="px-5 py-10 text-center text-textS font-mono text-xs">Memuat…</td></tr>
                )}
                {!loading && filtered.length === 0 && (
                  <tr><td colSpan={5} className="px-5 py-12 text-center text-textS">
                    <CalendarIcon size={28} className="mx-auto opacity-40 mb-3" />
                    Belum ada booking yang cocok.
                  </td></tr>
                )}
                {!loading && filtered.map((b) => (
                  <tr key={b.id} className="hover:bg-white/[0.02]" data-testid={`booking-row-${b.id}`}>
                    <td className="px-5 py-4">
                      <div className="font-semibold">{b.name}</div>
                      <div className="text-xs text-textS flex items-center gap-3 mt-1">
                        <span className="inline-flex items-center gap-1"><Mail size={11} /> {b.email}</span>
                        <span className="inline-flex items-center gap-1"><Phone size={11} /> {b.phone}</span>
                      </div>
                      {b.notes && <div className="text-xs text-textS/80 mt-1.5 italic line-clamp-1 max-w-[28ch]">"{b.notes}"</div>}
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{b.service_name}</div>
                      <div className="text-xs text-textS font-mono mt-0.5">#{b.id.slice(0, 8).toUpperCase()}</div>
                    </td>
                    <td className="px-5 py-4">
                      <div className="font-medium">{fmtDateID(b.date)}</div>
                      <div className="text-xs text-textS font-mono mt-0.5">{b.time} WIB</div>
                    </td>
                    <td className="px-5 py-4"><StatusBadge status={b.status} /></td>
                    <td className="px-5 py-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {b.status !== "confirmed" && (
                          <ActionBtn icon={CheckCircle2} title="Konfirmasi" onClick={() => updateStatus(b.id, "confirmed")} testId={`confirm-${b.id}`} />
                        )}
                        {b.status !== "completed" && (
                          <ActionBtn icon={BadgeCheck} title="Selesai" onClick={() => updateStatus(b.id, "completed")} testId={`complete-${b.id}`} />
                        )}
                        {b.status !== "pending" && (
                          <ActionBtn icon={Clock} title="Pending" onClick={() => updateStatus(b.id, "pending")} testId={`pending-${b.id}`} />
                        )}
                        {b.status !== "cancelled" && (
                          <ActionBtn icon={XCircle} title="Batalkan" onClick={() => updateStatus(b.id, "cancelled")} testId={`cancel-${b.id}`} />
                        )}
                        <ActionBtn icon={Trash2} title="Hapus" danger onClick={() => remove(b.id)} testId={`delete-${b.id}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatCard({ label, value, accent, small }) {
  return (
    <div className={`rounded-xl border p-4 md:p-5 ${accent ? "border-accent/40 bg-[rgba(209,255,77,0.06)]" : "border-white/10 bg-[#111]"}`}>
      <div className="text-[10px] font-mono uppercase tracking-[0.2em] text-textS">{label}</div>
      <div className={`mt-2 font-display font-bold ${small ? "text-base md:text-xl" : "text-2xl md:text-3xl"} ${accent ? "text-accent" : ""}`}>
        {value}
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, title, onClick, danger, testId }) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      data-testid={testId}
      className={`w-8 h-8 rounded-lg border flex items-center justify-center transition-all ${
        danger
          ? "border-danger/30 text-[#FF8FA9] hover:bg-danger/10 hover:border-danger/50"
          : "border-white/10 text-textS hover:text-accent hover:border-accent/40"
      }`}
    >
      <Icon size={14} />
    </button>
  );
}
