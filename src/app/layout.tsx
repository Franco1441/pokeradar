import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";

const pokedexHeading = localFont({
  src: "../../public/fonts/BarlowCondensed-Bold.ttf",
  variable: "--font-pokedex",
  display: "swap",
  weight: "700",
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
    <html lang="es" className={pokedexHeading.variable}>
      <body>{children}</body>
    </html>
  );
}
