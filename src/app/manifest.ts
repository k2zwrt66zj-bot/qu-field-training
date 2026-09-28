import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "التدريب الميداني - جامعة القصيم",
    short_name: "التدريب الميداني",
    description: "منصة إدارة التدريب الميداني لقسم الاجتماع والخدمة الاجتماعية",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#f6f7f7",
    theme_color: "#0f486e",
    icons: [
      { src: "/brand/emblem-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/brand/emblem-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
    ],
  };
}
