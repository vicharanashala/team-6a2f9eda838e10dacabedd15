/** @type {import('next').NextConfig} */
const nextConfig = {
  images: {
    domains: ['localhost'],
  },
  async rewrites() {
    const isVercel = process.env.VERCEL || process.env.NEXT_PUBLIC_VERCEL_ENV || process.env.VERCEL_URL;
    
    let apiDestination;
    let socketDestination;

    if (isVercel) {
      apiDestination = '/_/backend/api';
      socketDestination = '/_/backend/socket.io';
    } else {
      apiDestination = process.env.API_PROXY_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';
      // In case a localhost URL is mistakenly set in Vercel environment variables
      if (process.env.VERCEL_URL && apiDestination.includes('localhost')) {
        apiDestination = `https://${process.env.VERCEL_URL}/_/backend/api`;
      }
      
      socketDestination = process.env.API_PROXY_URL 
        ? 'http://backend:5000/socket.io' 
        : 'http://localhost:5000/socket.io';
      if (process.env.VERCEL_URL && socketDestination.includes('localhost')) {
        socketDestination = `https://${process.env.VERCEL_URL}/_/backend/socket.io`;
      }
    }

    return [
      {
        source: '/api/:path*',
        destination: `${apiDestination}/:path*`,
      },
      {
        source: '/socket.io/:path*',
        destination: `${socketDestination}/:path*`,
      },
    ];
  },
};

module.exports = nextConfig;
