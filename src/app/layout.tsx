import type { Metadata, Viewport } from "next";
import { IBM_Plex_Sans_Arabic } from "next/font/google";
import { Providers } from "@/components/layout/providers";
import { RegisterSW } from "@/components/pwa/register-sw";
import "./globals.css";

const arabic = IBM_Plex_Sans_Arabic({ subsets: ["arabic", "latin"], weight: ["300", "400", "500", "600", "700"], variable: "--font-arabic" });

export const metadata: Metadata = {
  title: { default: "التدريب الميداني | جامعة القصيم", template: "%s | التدريب الميداني" },
  description: "منصة إدارة التدريب الميداني - قسم الاجتماع والخدمة الاجتماعية - جامعة القصيم",
  applicationName: "التدريب الميداني",
  appleWebApp: { capable: true, title: "التدريب الميداني", statusBarStyle: "default" },
  icons: { icon: "/brand/emblem-64.png", apple: "/brand/emblem-192.png" },
};

export const viewport: Viewport = { themeColor: "#0f486e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className={`${arabic.variable} font-sans`}>
        <Providers>{children}</Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
