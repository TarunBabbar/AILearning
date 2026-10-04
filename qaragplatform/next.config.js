/** @type {import('next').NextConfig} */
const nextConfig = {
  // These parsers load native/dynamic requires (and pdf-parse ships a test file
  // read), so keep them out of the server bundle and require them at runtime.
  experimental: {
    serverComponentsExternalPackages: ['pdf-parse', 'mammoth', 'xlsx'],
  },
}

module.exports = nextConfig
