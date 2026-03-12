/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    outputFileTracingIncludes: {
      '/api/fs/bs': ['./BS/**/*'],
      '/api/fs/cf': ['./cashflow/**/*'],
      '/api/fs/pl': ['./PL/**/*', './credit/**/*', './여신회수계획/**/*'],
      '/api/fs/working-capital': ['./cashflow/**/*'],
      '/api/fs/working-capital-statement': ['./운전자본/**/*'],
    },
  },
};

module.exports = nextConfig;




