import type { Metadata } from "next";
import "./globals.css";
import { Header } from "@/components/Header";
import { ToastProvider } from "@/components/Toast";

export const metadata: Metadata = { title: "Sproutworks" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link href="https://fonts.googleapis.com/css2?family=Atkinson+Hyperlegible+Next:wght@400;600;700&family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700;12..96,800&family=Martian+Mono:wght@400;500&display=swap" rel="stylesheet" />
      </head>
      <body>
        <ToastProvider>
          <Header />
          <main>{children}</main>
        </ToastProvider>
      </body>
    </html>
  );
}
