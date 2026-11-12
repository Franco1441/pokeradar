import type { Metadata } from "next";
import "./globals.css";

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
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
