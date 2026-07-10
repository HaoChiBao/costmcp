import type { Metadata } from "next";
import { Antonio, Fraunces, Inter } from "next/font/google";
import "./globals.css";

const louize = Fraunces({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-louize-display",
  display: "swap",
});

const ui = Inter({
  subsets: ["latin"],
  weight: ["400", "700"],
  variable: "--font-neue-montreal",
  display: "swap",
});

const manuka = Antonio({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-manuka",
  display: "swap",
});

export const metadata: Metadata = {
  title: "CostMCP",
  description: "Organized AI cost tracking for builders",
  icons: {
    icon: [{ url: "/logo.png", type: "image/png" }],
    apple: [{ url: "/apple-icon.png", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${louize.variable} ${ui.variable} ${manuka.variable}`}>
      <body>{children}</body>
    </html>
  );
}
