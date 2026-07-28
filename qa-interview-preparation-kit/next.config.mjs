/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ["pdf-parse", "chromadb"],
    esmExternals: "loose",
  },
};

export default nextConfig;
