/** @type {import('next').NextConfig} */
const nextConfig = {
  // Streaming responses from the analyze route can run longer than the default
  // edge timeout; we rely on the Node runtime declared in route.ts.
};

export default nextConfig;
