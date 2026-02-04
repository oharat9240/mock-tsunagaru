import type { Config } from "@react-router/dev/config";

const config: Config = {
  // Config options...
  // Server-side render by default, to enable SPA mode set this to `false`
  ssr: false,
  prerender: false,
};

if (process.env.NODE_ENV === "production") {
  config.basename = "/mock-tsunagaru";
}

export default config;
