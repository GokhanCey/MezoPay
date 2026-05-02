import { useReadContract } from "wagmi";
import { formatEther } from "viem";
import { getContracts } from "../config/contracts";
import { mezoTestnet } from "../config/wagmi";

const MUSD_BALANCE_ABI = [
  {
    name: "balanceOf",
    type: "function",
    stateMutability: "view",
    inputs: [{ name: "account", type: "address" }],
    outputs: [{ name: "", type: "uint256" }],
  },
];

const MUSD_ALLOWANCE_ABI = [
  {
    name: "allowance",
    type: "function",
    stateMutability: "view",
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    outputs: [{ name: "", type: "uint256" }],
  },
];

/**
 * Read MUSD balance for an address on Mezo Testnet.
 */
export function useMUSDBalance(address) {
  const contracts = getContracts();

  const { data, isLoading, refetch } = useReadContract({
    address: contracts.musd,
    abi: MUSD_BALANCE_ABI,
    functionName: "balanceOf",
    args: address ? [address] : undefined,
    chainId: mezoTestnet.id,
    query: {
      enabled: !!address,
      refetchInterval: 12000,
    },
  });

  return {
    balance: data != null ? formatEther(data) : "0",
    balanceRaw: data != null ? data : 0n,
    isLoading,
    refetch,
  };
}

/**
 * Read MUSD allowance on Mezo Testnet.
 */
export function useMUSDAllowance(owner, spender) {
  const contracts = getContracts();

  const { data, isLoading, refetch } = useReadContract({
    address: contracts.musd,
    abi: MUSD_ALLOWANCE_ABI,
    functionName: "allowance",
    args: owner && spender ? [owner, spender] : undefined,
    chainId: mezoTestnet.id,
    query: {
      enabled: !!owner && !!spender,
      refetchInterval: 10000,
    },
  });

  return {
    allowance: data != null ? data : 0n,
    isLoading,
    refetch,
  };
}
