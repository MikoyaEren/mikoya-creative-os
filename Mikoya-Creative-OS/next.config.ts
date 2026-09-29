import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The HTML renderer drives a headless Chromium and processes images on the server.
  serverExternalPackages: ["playwright-core", "sharp"],
  // Bundled fonts are read from disk by the renderer.
  outputFileTracingIncludes: { "/api/**": ["./assets/fonts/**"] },
};

export default nextConfig;
