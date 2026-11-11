import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const display = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  weight: "400 800",
  variable: "--font-display",
  display: "swap",
});
const sans = localFont({
  src: "./fonts/dm-sans.woff2",
  weight: "400 800",
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "PokéRadar · Diario de expedición",
  description:
    "Un mundo por descubrir. Explora cinco hábitats, descubre Pokémon y construye tu propio diario de campo.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${display.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
