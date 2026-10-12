import type { MetadataRoute } from "next";

// built once at build time (also required by the static Pages export)
export const dynamic = "force-static";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://helix-labs-3d.vercel.app/", lastModified: new Date("2026-10-10"), priority: 1 }];
}
