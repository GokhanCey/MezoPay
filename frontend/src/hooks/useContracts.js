import { useWriteContract } from "wagmi";
import { parseEther } from "viem";
import { getContracts } from "../config/contracts";
import { mezoTestnet } from "../config/wagmi";

const CHAIN_ID = mezoTestnet.id;

export function useContracts() {
  const contracts = getContracts();
  const { writeContractAsync } = useWriteContract();

  // MUSD approve
  async function approveMUSD(spender, amount) {
    return writeContractAsync({
      address: contracts.musd,
      abi: [
        {
          name: "approve",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "spender", type: "address" },
            { name: "amount", type: "uint256" },
          ],
          outputs: [{ type: "bool" }],
        },
      ],
      functionName: "approve",
      args: [spender, amount],
      chainId: CHAIN_ID,
    });
  }

  // Register merchant on-chain
  async function registerMerchant(name, webhookUrl) {
    return writeContractAsync({
      address: contracts.registry,
      abi: [
        {
          name: "registerMerchant",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "name", type: "string" },
            { name: "webhookUrl", type: "string" },
          ],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "registerMerchant",
      args: [name, webhookUrl],
      chainId: CHAIN_ID,
    });
  }

  // Create a payment plan on-chain
  async function createPlan(merchantId, name, priceInMUSD, planType, billingInterval) {
    return writeContractAsync({
      address: contracts.plans,
      abi: [
        {
          name: "createPlan",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [
            { name: "merchantId", type: "uint256" },
            { name: "name", type: "string" },
            { name: "priceInMUSD", type: "uint256" },
            { name: "planType", type: "uint8" },
            { name: "billingInterval", type: "uint256" },
          ],
          outputs: [{ type: "uint256" }],
        },
      ],
      functionName: "createPlan",
      args: [
        BigInt(merchantId),
        name,
        parseEther(priceInMUSD.toString()),
        planType,
        BigInt(billingInterval),
      ],
      chainId: CHAIN_ID,
    });
  }

  // Subscribe to a plan (initiates payment)
  async function subscribe(planId) {
    return writeContractAsync({
      address: contracts.processor,
      abi: [
        {
          name: "subscribe",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [{ name: "planId", type: "uint256" }],
          outputs: [{ type: "bytes32" }],
        },
      ],
      functionName: "subscribe",
      args: [BigInt(planId)],
      chainId: CHAIN_ID,
    });
  }

  // Cancel a subscription
  async function cancelSubscription(planId) {
    return writeContractAsync({
      address: contracts.processor,
      abi: [
        {
          name: "cancelSubscription",
          type: "function",
          stateMutability: "nonpayable",
          inputs: [{ name: "planId", type: "uint256" }],
          outputs: [],
        },
      ],
      functionName: "cancelSubscription",
      args: [BigInt(planId)],
      chainId: CHAIN_ID,
    });
  }

  return {
    contracts,
    approveMUSD,
    registerMerchant,
    createPlan,
    subscribe,
    cancelSubscription,
  };
}
