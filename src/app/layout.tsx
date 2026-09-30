import type { Metadata, Viewport } from "next";
// الخط محلي (لا يحتاج اتصالاً بالإنترنت عند البناء أو العرض)؛ ملفات الأوزان تتضمن unicode-range
import "@fontsource/ibm-plex-sans-arabic/300.css";
import "@fontsource/ibm-plex-sans-arabic/400.css";
import "@fontsource/ibm-plex-sans-arabic/500.css";
import "@fontsource/ibm-plex-sans-arabic/600.css";
import "@fontsource/ibm-plex-sans-arabic/700.css";
import { Providers } from "@/components/layout/providers";
import { RegisterSW } from "@/components/pwa/register-sw";
import { DEVELOPER } from "@/lib/developer";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "التدريب الميداني | جامعة القصيم", template: "%s | التدريب الميداني" },
  description: "منصة إدارة التدريب الميداني - قسم الاجتماع والخدمة الاجتماعية - جامعة القصيم",
  applicationName: "التدريب الميداني",
  // المؤسس والمطور (Abdalmalik Awad Al-Otaibi) — انظر src/lib/developer.ts
  authors: [{ name: DEVELOPER.nameEn }],
  creator: DEVELOPER.nameEn,
  publisher: DEVELOPER.nameEn,
  appleWebApp: { capable: true, title: "التدريب الميداني", statusBarStyle: "default" },
  icons: { icon: "/brand/emblem-64.png", apple: "/brand/emblem-192.png" },
};

export const viewport: Viewport = { themeColor: "#0f486e", width: "device-width", initialScale: 1 };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ar" dir="rtl" suppressHydrationWarning>
      <body className="font-sans">
        <Providers>{children}</Providers>
        <RegisterSW />
      </body>
    </html>
  );
}
