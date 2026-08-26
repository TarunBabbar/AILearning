import type { NextConfig } from 'next';
import path from 'node:path';

const nextConfig: NextConfig = {
  output: 'standalone',
  serverExternalPackages: ['better-sqlite3', 'js-yaml'],
  turbopack: {
    root: path.resolve(__dirname),
  },
};

export default nextConfig;
