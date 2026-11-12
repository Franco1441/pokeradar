import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const editorial = localFont({
  src: "./fonts/instrument-serif.woff2",
  weight: "400",
  variable: "--font-serif",
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
    "Explorá siete hábitats, descubrí Pokémon y armá tu diario de expedición.",
  icons: { icon: "/icon.svg" },
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={`${editorial.variable} ${sans.variable}`}>
      <body>{children}</body>
    </html>
  );
}
