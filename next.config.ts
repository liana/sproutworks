import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // libsql ships native bindings; keep it out of the bundle.
  serverExternalPackages: ["@libsql/client", "@prisma/adapter-libsql"],
};

export default nextConfig;
