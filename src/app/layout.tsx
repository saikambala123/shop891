import type { Metadata, Viewport } from "next";
import { Chakra_Petch, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// Esports display face matched to the shop-891 gorilla emblem.
const chakraPetch = Chakra_Petch({
  variable: "--font-chakra",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

// Mobile viewport: zoom is locked (maximum-scale=1, user-scalable=no)
// so a two-finger pinch never zooms the store — the app is built
// mobile-first and any accidental zoom breaks the layout. Safe-area
// insets are respected via viewportFit cover (notch / home bar).
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  title: "shop-891 — Online Shopping for Electronics, Fashion, Home & More",
  description:
    "shop-891 is India's modern online marketplace — mobiles, electronics, fashion, beauty, home & kitchen, plants, groceries, books, toys, sports and everyday essentials, all in one place with secure UPI & card payments, coupon deals and free delivery over ₹499.",
  keywords: [
    "shop-891",
    "shop 891",
    "891",
    "ecommerce",
    "online shopping",
    "online shopping India",
    "mobiles",
    "electronics",
    "fashion",
    "beauty",
    "home essentials",
    "indoor plants",
    "grocery",
    "books",
    "toys",
    "sports",
    "India",
  ],
  authors: [{ name: "shop-891" }],
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "32x32" },
      { url: "/logo.png", type: "image/png", sizes: "512x512" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "shop-891 — Online Shopping for Electronics, Fashion, Home & More",
    description:
      "Mobiles, electronics, fashion, beauty, home, plants, grocery and more — delivered to your doorstep. Coupons and daily deals.",
    siteName: "shop-891",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${chakraPetch.variable} antialiased bg-background text-foreground`}
      >
        {children}
        <Toaster />
      </body>
    </html>
  );
}
