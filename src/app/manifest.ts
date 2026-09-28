import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "التدريب الميداني - جامعة القصيم",
    short_name: "التدريب الميداني",
    description: "منصة إدارة التدريب الميداني لقسم علم الاجتماع والخدمة الاجتماعية",
    start_url: "/",
    display: "standalone",
    dir: "rtl",
    lang: "ar",
    background_color: "#f6f7f7",
    theme_color: "#0f6b45",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" }],
  };
}
