module.exports = {
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      colors: {
        bg: "#0A0A0A",
        surface: "#121212",
        surface2: "#1A1A1A",
        accent: "#D1FF4D",
        accentHover: "#E2FF7A",
        cyan2: "#00E5FF",
        textP: "#FFFFFF",
        textS: "#A1A1AA",
        danger: "#FF3366",
        warn: "#FFB800",
      },
      fontFamily: {
        display: ["'Clash Display'", "'Space Grotesk'", "sans-serif"],
        body: ["'Satoshi'", "'DM Sans'", "system-ui", "sans-serif"],
        mono: ["'JetBrains Mono'", "ui-monospace", "monospace"],
      },
      boxShadow: {
        glow: "0 0 32px rgba(209, 255, 77, 0.35)",
        card: "0 8px 32px rgba(0,0,0,0.5)",
      },
      keyframes: {
        pulseGlow: {
          "0%,100%": { boxShadow: "0 0 0 0 rgba(209,255,77,0.55)" },
          "50%": { boxShadow: "0 0 0 12px rgba(209,255,77,0)" },
        },
        floaty: {
          "0%,100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-12px)" },
        },
        gridShift: {
          "0%": { backgroundPosition: "0 0" },
          "100%": { backgroundPosition: "60px 60px" },
        },
        scrollMarquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        pulseGlow: "pulseGlow 2.4s ease-out infinite",
        floaty: "floaty 6s ease-in-out infinite",
        gridShift: "gridShift 22s linear infinite",
        marquee: "scrollMarquee 38s linear infinite",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
};
