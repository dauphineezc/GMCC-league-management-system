// app/layout.tsx
import "./globals.css";
import { Racing_Sans_One, Montserrat } from "next/font/google";
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

const racing = Racing_Sans_One({ weight: "400", subsets: ["latin"], variable: "--font-sport" });
const montserrat = Montserrat({ subsets: ["latin"], variable: "--font-body" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=optional" />
      </head>
      <body className={`${montserrat.variable} ${racing.variable}`}>
        <NavbarWrapper />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
