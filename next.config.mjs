/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['geoip-lite', '@prisma/client', 'bcryptjs'],
  images: {
    unoptimized: true,
  },
}

export default nextConfig
