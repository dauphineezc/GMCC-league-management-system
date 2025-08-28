// app/layout.tsx
import "./globals.css";
import { Racing_Sans_One, Inter } from "next/font/google";
import Navbar from "@/components/navbar";

const racing = Racing_Sans_One({ weight: "400", subsets: ["latin"], variable: "--font-sport" });
const inter = Inter({ subsets: ["latin"], variable: "--font-body" });

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      {/* expose font CSS variables to global.css */}
      <body className={`${inter.variable} ${racing.variable}`}>
        <Navbar />
        <main className="container">{children}</main>
      </body>
    </html>
  );
}
