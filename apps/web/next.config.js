const path = require('path')

/** @type {import('next').NextConfig} */
const nextConfig = {
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: true,
  },
  output: 'standalone',
  transpilePackages: [
    '@comp-dash/api',
    '@comp-dash/design-system',
    '@comp-dash/hooks',
    '@comp-dash/i18n',
    '@comp-dash/types',
    '@comp-dash/utils',
  ],
}

module.exports = nextConfig
