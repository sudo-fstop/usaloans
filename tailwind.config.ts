import type { Config } from "tailwindcss";

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ["Inter", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      colors: {
        ink: "#17211d",
        moss: "#325246",
        mint: "#e6f4ed",
        coral: "#c84f31",
        butter: "#f7d36b",
        cloud: "#f7f8f5",
      },
      boxShadow: {
        panel: "0 1px 2px rgba(23, 33, 29, 0.08)",
      },
    },
  },
  plugins: [],
} satisfies Config;
