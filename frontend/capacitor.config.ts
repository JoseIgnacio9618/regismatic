import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.regismatic.app",
  appName: "Regismatic",
  webDir: "www",
  server: {
    androidScheme: "https"
  }
};

export default config;
