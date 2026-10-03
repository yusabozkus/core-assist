import type { NextConfig } from "next"

const nextConfig: NextConfig = {
  output: "standalone",
  devIndicators: false,
  async redirects() {
    return [
      {
        source: "/dashboard/settings/billing",
        destination: "/billing",
        permanent: true,
      },
      {
        source: "/dashboard/settings/billing/plans",
        destination: "/billing?view=plans",
        permanent: true,
      },
      {
        source: "/dashboard/settings/billing/invoices",
        destination: "/billing?view=invoices",
        permanent: true,
      },
    ]
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "cdn.dsmcdn.com",
        port: "",
        pathname: "/**",
        search: "",
      },
      {
        protocol: "https",
        hostname: "productimages.hepsiburada.net",
        port: "",
        pathname: "/**",
        search: "",
      },
      // Google profile photos use numbered lh*.googleusercontent.com hosts.
      ...["lh3", "lh4", "lh5", "lh6"].map((host) => ({
        protocol: "https" as const,
        hostname: `${host}.googleusercontent.com`,
        port: "",
        pathname: "/**",
        search: "",
      })),
    ],
    // Redirects must not bypass the source allowlist. Microsoft avatars are
    // inline data URLs, so they don't require another remote image host.
    maximumRedirects: 0,
    dangerouslyAllowLocalIP: false,
  },
}

export default nextConfig
