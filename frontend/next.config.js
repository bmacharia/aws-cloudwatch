/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  images: {
    unoptimized: true,
  },
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_API_URL_REST: process.env.API_URL_REST,
    NEXT_PUBLIC_API_URL_WS: process.env.API_URL_WS,
  },
};

module.exports = nextConfig;
