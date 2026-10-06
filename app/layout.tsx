import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "NOTECOACH",
  description: "Grava, transcreve e organiza as tuas notas."
};

export default function RootLayout({
  children
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt">
      <body>{children}</body>
    </html>
  );
}
