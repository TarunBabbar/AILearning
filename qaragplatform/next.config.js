/** @type {import('next').NextConfig} */
const nextConfig = {
  // These parsers load native/dynamic requires (and pdf-parse reads files at
  // runtime), so keep them out of the server bundle and require them at runtime.
  serverExternalPackages: ['pdf-parse', 'mammoth', 'xlsx'],
}

module.exports = nextConfig
