import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: [
    "@rentbrown/api-client",
    "@rentbrown/design-tokens",
    "@rentbrown/types",
    "@rentbrown/domain",
  ],
  reactStrictMode: true,
};

export default nextConfig;
