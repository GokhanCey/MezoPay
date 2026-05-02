import { getDefaultConfig } from "@rainbow-me/rainbowkit";
import { http } from "wagmi";

// Mezo Testnet only - mainnet not active yet
export const mezoTestnet = {
  id: 31611,
  name: "Mezo Testnet",
  nativeCurrency: { name: "Bitcoin", symbol: "BTC", decimals: 18 },
  rpcUrls: {
    default: { http: ["https://rpc.test.mezo.org"] },
    public: { http: ["https://rpc.test.mezo.org"] },
  },
  blockExplorers: {
    default: { name: "Mezo Explorer", url: "https://explorer.test.mezo.org" },
  },
  testnet: true,
};

export const wagmiConfig = getDefaultConfig({
  appName: "MezoPay",
  projectId: "e9f0e21ea1e34ccdf1d3e8e2c3cf3d0b",
  chains: [mezoTestnet],
  transports: {
    [mezoTestnet.id]: http("https://rpc.test.mezo.org"),
  },
  ssr: false,
});
