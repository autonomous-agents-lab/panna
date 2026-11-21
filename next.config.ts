import type { NextConfig } from "next";

// Loading config here makes an invalid env value fail `next dev` and `next build` immediately.
import "./src/config";

const nextConfig: NextConfig = {};

export default nextConfig;
