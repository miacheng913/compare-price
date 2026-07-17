import type { Metadata, Viewport } from "next";
import "./globals.css";

const basePath = process.env.GITHUB_ACTIONS === "true" ? "/compare-price" : "";

export const metadata: Metadata = {
  title: "比價小幫手｜聰明比較每一筆",
  description: "記錄各賣場價格、自動換算單價，讓每次採買都有更聰明的選擇。",
  applicationName: "比價小幫手",
  manifest: `${basePath}/manifest.webmanifest`,
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "比價小幫手",
  },
  icons: {
    apple: [{ url: `${basePath}/apple-touch-icon.png`, sizes: "180x180", type: "image/png" }],
    icon: [
      { url: `${basePath}/icon-192.png`, sizes: "192x192", type: "image/png" },
      { url: `${basePath}/icon-512.png`, sizes: "512x512", type: "image/png" },
    ],
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#6c4f78",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="zh-Hant"><body>{children}</body></html>;
}
