/** @type {import('next').NextConfig} */
const isProduction = process.env.NODE_ENV === "production";

const scriptSrc = ["'self'", "'unsafe-inline'"];
if (!isProduction) {
  // Next.js dev runtime uses eval for fast refresh/source maps.
  scriptSrc.push("'unsafe-eval'");
}

const styleSrc = ["'self'", "'unsafe-inline'", "https://fonts.googleapis.com"];

const cspDirectives = [
  "default-src 'self'",
  `script-src ${scriptSrc.join(" ")}`,
  `style-src ${styleSrc.join(" ")}`,
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' blob: data: https://i.ytimg.com https://*.fbcdn.net",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-src 'self' https://www.youtube.com https://www.youtube-nocookie.com https://www.facebook.com",
  "frame-ancestors 'none'",
];

if (isProduction) {
  cspDirectives.push("upgrade-insecure-requests");
}

const cspHeader = `${cspDirectives.join("; ")};`;

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
            value: cspHeader,
          },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Permissions-Policy",
            value:
              "camera=(), microphone=(), geolocation=(), payment=(), usb=()",
          },
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
