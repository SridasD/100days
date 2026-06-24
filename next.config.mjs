/** @type {import('next').NextConfig} */
const cspHeader = `
  default-src 'self';
  script-src 'self' 'unsafe-eval' 'unsafe-inline';
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' blob: data: https://i.ytimg.com https://*.fbcdn.net;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.facebook.com;
  frame-ancestors 'none';
  upgrade-insecure-requests;
`;

const nextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  experimental: {
    serverActions: { bodySizeLimit: "50mb" },
  },
  webpack(config) {
    // Exclude migration SQL files from the webpack bundle/cache
    config.module.rules.push({
      test: /\.sql$/,
      use: "ignore-loader",
    });
    return config;
  },
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          {
            key: "Content-Security-Policy",
            value: cspHeader.replace(/\n/g, ""),
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=31536000; includeSubDomains",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
