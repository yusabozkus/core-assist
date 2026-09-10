import type { NextConfig } from "next"

const nextConfig: NextConfig = {
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
    remotePatterns: [{ protocol: "https", hostname: "**" }],
  },
}

export default nextConfig
