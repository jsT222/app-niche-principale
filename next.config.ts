import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/dashboard", destination: "/", permanent: false },
      { source: "/tableau-de-bord", destination: "/", permanent: false },
      { source: "/accueil", destination: "/", permanent: false },
      { source: "/reservation", destination: "/reservations", permanent: false },
      { source: "/booking", destination: "/reserver", permanent: false },
      { source: "/automations", destination: "/automatisations", permanent: false },
      { source: "/connexion", destination: "/login", permanent: false },
      { source: "/menage", destination: "/housekeeping", permanent: false },
    ];
  },
};

export default nextConfig;
