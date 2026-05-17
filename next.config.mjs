/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // yahoo-finance2 ships Deno-flavored test modules that webpack can't resolve.
  // Treat it as an external Node module on the server so it's required at runtime
  // instead of bundled.
  experimental: {
    serverComponentsExternalPackages: ["yahoo-finance2"],
  },
};

export default nextConfig;
