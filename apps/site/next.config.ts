import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@rentbrown/design-tokens"],
  reactStrictMode: true,
};

export default nextConfig;
