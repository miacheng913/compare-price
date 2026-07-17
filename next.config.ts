import type { NextConfig } from "next";

const isGitHubPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: { unoptimized: true },
  trailingSlash: true,
  basePath: isGitHubPages ? "/compare-price" : "",
  assetPrefix: isGitHubPages ? "/compare-price/" : "",
};

export default nextConfig;
