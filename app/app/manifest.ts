import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Taller Móvil del Mecánico",
    short_name: "Taller Móvil",
    description: "Control rápido de cobros, stock e historial para rutero de transporte pesado.",
    start_url: "/",
    display: "standalone",
    background_color: "#071822",
    theme_color: "#f4b942",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
      },
    ],
  };
}
