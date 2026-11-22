import type { NextConfig } from "next";

// Loading config here makes an invalid env value fail `next dev` and `next build` immediately.
import "./src/config";
import { buildTimeEnv } from "./src/config/build";

const nextConfig: NextConfig = {
  // Bakes build-time values into the server build, since a host may not pass build variables
  // to its functions at runtime.
  env: buildTimeEnv(process.env),
};

export default nextConfig;
