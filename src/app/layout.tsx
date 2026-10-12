// app/layout.tsx
import "./globals.css";
import { Barlow_Semi_Condensed, Montserrat } from "next/font/google";
import NavbarWrapper from "@/components/navbarWrapper";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "League Management System",
  description: "GMCC League Management System",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
};

const sport = Barlow_Semi_Condensed({ weight: ["600", "700", "800"], subsets: ["latin"], variable: "--font-sport" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-body" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional" />
      </head>
      <body className={`${montserrat.variable} ${sport.variable}`}>
        <NavbarWrapper />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
