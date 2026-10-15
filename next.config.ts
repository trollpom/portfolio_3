import type { NextConfig } from "next";

const config: NextConfig = {
  // This is a server-capable app. `output: "export"` would remove RSVP.
  poweredByHeader: false,
};

export default config;
