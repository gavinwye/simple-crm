/** @type {import('next').NextConfig} */
const nextConfig = {
  // better-sqlite3 is a native module; ensure it's resolved on the server.
  serverExternalPackages: ['better-sqlite3'],
};

export default nextConfig;
