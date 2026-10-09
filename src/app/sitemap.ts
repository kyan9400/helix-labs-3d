import type { MetadataRoute } from "next";

export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: "https://helix-labs-3d.vercel.app/", lastModified: new Date("2026-10-10"), priority: 1 }];
}
