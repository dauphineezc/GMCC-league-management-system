/** @type {import('next').NextConfig} */
const nextConfig = {
    experimental: { 
      serverActions: { 
        allowedOrigins: ['localhost:3000', '*.vercel.app', '*.vercel.com'] 
      } 
    }
  };
  export default nextConfig;
  