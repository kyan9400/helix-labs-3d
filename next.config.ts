import type { NextConfig } from "next";

// GH_PAGES=1 builds a static mirror for GitHub Pages (npm run build:pages).
// The normal Vercel build is unchanged.
const pages = process.env.GH_PAGES === "1";
const base = "/helix-labs-3d";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // the 3D chunk fetches public/ files (the PDB structure) and needs the Pages sub-path
  env: { NEXT_PUBLIC_BASE_PATH: pages ? base : "" },
  experimental: {
    // CSS goes into the HTML: no render-blocking stylesheet request on mobile
    inlineCss: true,
  },
  ...(pages
    ? {
        // static export served from github.io/helix-labs-3d/
        output: "export",
        basePath: base,
        assetPrefix: base,
        images: { unoptimized: true },
        trailingSlash: true,
      }
    : {
        // custom headers need a server, so Vercel only
        async headers() {
          return [
            {
              source: "/(.*)",
              headers: [
                { key: "X-Content-Type-Options", value: "nosniff" },
                { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
                { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
              ],
            },
          ];
        },
      }),
};

export default nextConfig;
