/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    return [
      {
        source: '/api/:path*',
        destination: `${process.env.API_PROXY_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api'}/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${process.env.API_PROXY_URL ? 'http://backend:5000' : 'http://localhost:5000'}/socket.io/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
