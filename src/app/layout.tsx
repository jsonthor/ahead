import { AuthRedirect } from "@/components/auth/auth-redirect";
import type { Metadata } from "next";
import { Geist, Geist_Mono, Newsreader } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
});

export const metadata: Metadata = {
  title: "Ahead — Know if your training is working",
  description:
    "Ahead connects your training, recovery and races to show what’s changing — and help you decide what to do next. For self-coached endurance athletes.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} ${newsreader.variable} h-full bg-[#050505] antialiased`}
    >
      <body className="min-h-full bg-paper font-sans text-ink">
        <AuthRedirect />
        {children}
      </body>
    </html>
  );
}
