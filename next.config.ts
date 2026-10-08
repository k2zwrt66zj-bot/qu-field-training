import type { NextConfig } from "next";

/**
 * ملفات تقرؤها المستندات الرسمية (الخطابات وملفات PDF) من القرص وقت الطلب: الشعار والخطوط المضمّنة.
 * على Vercel لا تُنسخ ملفات public ولا هذه الخطوط إلى دوال الخادم تلقائياً، فنضمّنها صراحةً.
 */
const DOCUMENT_ASSETS = [
  "./public/brand/qu-logo.png",
  "./node_modules/@fontsource/amiri/{400,700}.css",
  "./node_modules/@fontsource/amiri/files/amiri-{arabic,latin}-{400,700}-normal.woff2",
  "./node_modules/@fontsource/ibm-plex-sans-arabic/{400,600}.css",
  "./node_modules/@fontsource/ibm-plex-sans-arabic/files/ibm-plex-sans-arabic-{arabic,latin}-{400,600}-normal.woff2",
];
const DOCUMENT_ROUTES = [
  "/letters/*",
  "/api/letters/*/pdf",
  "/api/forms/*/pdf",
  "/api/portfolio/*/pdf",
  "/api/meetings/*/pdf",
  "/api/attendance-sheets/*/*/pdf",
];

const nextConfig: NextConfig = {
  serverExternalPackages: ["puppeteer-core", "@prisma/client", "bcryptjs"],
  outputFileTracingIncludes: Object.fromEntries(DOCUMENT_ROUTES.map((r) => [r, DOCUMENT_ASSETS])),
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          // السماح بتحديد الموقع من نفس النطاق فقط
          { key: "Permissions-Policy", value: "geolocation=(self), camera=(), microphone=()" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "X-Frame-Options", value: "DENY" },
          // HTTPS إلزامي في المتصفح لسنتين (يُتجاهل على http://localhost)
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
        ],
      },
      {
        source: "/sw.js",
        headers: [
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Service-Worker-Allowed", value: "/" },
        ],
      },
    ];
  },
};

export default nextConfig;
