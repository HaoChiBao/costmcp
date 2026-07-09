import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/** @type {import('next').NextConfig} */
const nextConfig = {
  outputFileTracingRoot: path.join(__dirname, "../.."),
  transpilePackages: ["@costmcp/core", "@costmcp/db"],
  async rewrites() {
    // OAuth discovery documents must be served from the root .well-known path
    // (RFC 8414 / RFC 9728). We implement them under /api and rewrite so CORS
    // middleware and route handlers apply cleanly. Path-suffixed variants are
    // included because some MCP clients append the resource path.
    return [
      {
        source: "/.well-known/oauth-authorization-server",
        destination: "/api/oauth/metadata/authorization-server",
      },
      {
        source: "/.well-known/oauth-authorization-server/:path*",
        destination: "/api/oauth/metadata/authorization-server",
      },
      {
        source: "/.well-known/oauth-protected-resource",
        destination: "/api/oauth/metadata/protected-resource",
      },
      {
        source: "/.well-known/oauth-protected-resource/:path*",
        destination: "/api/oauth/metadata/protected-resource",
      },
    ];
  },
};

export default nextConfig;
