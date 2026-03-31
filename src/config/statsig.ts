import { StatsigClient } from "@statsig/react-bindings";
import { getRuntimeConfig } from "./runtimeConfig";

export const statsigClient = new StatsigClient(
  getRuntimeConfig("VITE_STATSIG_CLIENT_KEY", "client-YOUR_STATSIG_CLIENT_KEY"),
  { userID: "anonymous" },
  { 
    environment: { 
      tier: import.meta.env.DEV ? "development" : "production" 
    } 
  }
);

// Log initialization status for debugging
statsigClient.initializeAsync()
  .then(() => console.log("[Statsig] Initialized successfully"))
  .catch((e) => console.error("[Statsig] Initialization failed:", e));
