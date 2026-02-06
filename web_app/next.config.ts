import type { NextConfig } from "next";

const isProd = process.env.NODE_ENV === 'production';

const nextConfig: NextConfig = {
  /* config options here */
  output: 'export',
  basePath: isProd ? '/3' : '',
  images: {
    unoptimized: true,
  },
  reactCompiler: true,
};

export default nextConfig;
