import React, { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { formatApiErrorDetail } from "../lib/api";
import { Lock, Sparkles, ArrowLeft } from "lucide-react";

export default function AdminLogin() {
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (user && user.role === "admin") navigate("/admin", { replace: true });
  }, [user, navigate]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const u = await login(email, password);
      if (u.role === "admin") navigate("/admin", { replace: true });
      else setError("Akun ini bukan admin");
    } catch (err) {
      setError(formatApiErrorDetail(err.response?.data?.detail) || err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <section className="min-h-screen flex items-center justify-center px-4 bg-grid">
      <div className="absolute top-6 left-6">
        <Link to="/" className="inline-flex items-center gap-2 text-textS hover:text-white text-sm" data-testid="login-back">
          <ArrowLeft size={14} /> Beranda
        </Link>
      </div>
      <div className="w-full max-w-md rounded-2xl border border-white/10 bg-[#121212] p-7 md:p-9" data-testid="admin-login-card">
        <div className="flex items-center gap-2.5 mb-7">
          <div className="w-9 h-9 rounded-lg bg-accent flex items-center justify-center text-bg shadow-glow">
            <Sparkles size={16} strokeWidth={2.5} />
          </div>
          <span className="font-display font-bold text-lg">InScale<span className="text-accent">.</span>Digital</span>
        </div>

        <div className="text-[11px] font-mono uppercase tracking-[0.25em] text-accent mb-2">// Admin Console</div>
        <h1 className="font-display font-black text-3xl md:text-4xl tracking-tight mb-2">Login Admin</h1>
        <p className="text-textS text-sm mb-7">Masuk untuk melihat & mengelola booking yang masuk.</p>

        <form onSubmit={submit} className="space-y-4" data-testid="admin-login-form">
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-[0.18em] text-textS mb-2">Email</span>
            <input
              type="email"
              className="input-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@inscaledigital.id"
              required
              data-testid="admin-email-input"
            />
          </label>
          <label className="block">
            <span className="block text-[11px] font-mono uppercase tracking-[0.18em] text-textS mb-2">Password</span>
            <input
              type="password"
              className="input-base"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
              data-testid="admin-password-input"
            />
          </label>

          {error && (
            <div className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-sm text-[#FF8FA9]" data-testid="admin-login-error">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full inline-flex items-center justify-center gap-2 bg-accent hover:bg-accentHover disabled:opacity-60 text-bg font-bold px-5 py-3.5 rounded-xl transition-transform hover:scale-[1.01] active:scale-95"
            data-testid="admin-login-submit"
          >
            <Lock size={16} strokeWidth={2.5} /> {loading ? "Memproses…" : "Masuk"}
          </button>
        </form>
      </div>
    </section>
  );
}
