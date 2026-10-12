import type { MetadataRoute } from "next";

// built once at build time (also required by the static Pages export)
export const dynamic = "force-static";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: "https://helix-labs-3d.vercel.app/sitemap.xml",
  };
}
