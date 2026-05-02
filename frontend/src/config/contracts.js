// MezoPay Contract ABIs and Addresses
// Update these addresses after deploying contracts

export const CONTRACTS = {
  testnet: {
    chainId: 31611,
    rpcUrl: "https://rpc.test.mezo.org",
    explorer: "https://explorer.test.mezo.org",
    musd: "0x118917a40FAF1CD7a13dB0Ef56C86De7973Ac503",
    registry: "0xD61f2bA80E486B8CE30428ABFa8B1AD7FdC2Ec2C",
    plans: "0x4Acb793Ba5C8da6189fE4b0C737D04de4175F4ce",
    processor: "0x0bA5B5eF1dF0F711535b6B63D2E2bED59C1C9fD2",
  },
  mainnet: {
    chainId: 31612,
    rpcUrl: "https://mainnet.mezo.public.validationcloud.io/",
    explorer: "https://explorer.mezo.org",
    musd: "0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186",
    registry: "0x0000000000000000000000000000000000000000",
    plans: "0x0000000000000000000000000000000000000000",
    processor: "0x0000000000000000000000000000000000000000",
  },
};

// Default to testnet for development
export const ACTIVE_NETWORK = "testnet";

export function getContracts() {
  return CONTRACTS[ACTIVE_NETWORK];
}

export function getExplorerUrl(txHash) {
  const c = getContracts();
  return `${c.explorer}/tx/${txHash}`;
}

export function getExplorerAddressUrl(address) {
  const c = getContracts();
  return `${c.explorer}/address/${address}`;
}

// ─── ABIs ──────────────────────────────────────────────────────

export const MUSD_ABI = [
  "function balanceOf(address) view returns (uint256)",
  "function allowance(address owner, address spender) view returns (uint256)",
  "function approve(address spender, uint256 amount) returns (bool)",
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)",
  "function symbol() view returns (string)",
  "function name() view returns (string)",
];

export const REGISTRY_ABI = [
  "function registerMerchant(string name, string webhookUrl) returns (uint256)",
  "function updateMerchant(uint256 merchantId, string name, string webhookUrl)",
  "function getMerchant(uint256 merchantId) view returns (tuple(uint256 merchantId, address wallet, string name, string webhookUrl, bool active, uint256 createdAt))",
  "function isMerchant(address wallet) view returns (bool)",
  "function getMerchantIdByWallet(address wallet) view returns (uint256)",
  "function merchantCount() view returns (uint256)",
  "event MerchantRegistered(uint256 indexed merchantId, address indexed wallet, string name)",
];

export const PLANS_ABI = [
  "function createPlan(uint256 merchantId, string name, uint256 priceInMUSD, uint8 planType, uint256 billingInterval) returns (uint256)",
  "function deactivatePlan(uint256 planId)",
  "function getPlan(uint256 planId) view returns (tuple(uint256 planId, uint256 merchantId, address merchantWallet, string name, uint256 priceInMUSD, uint8 planType, uint256 billingInterval, bool active, uint256 createdAt))",
  "function getMerchantPlans(uint256 merchantId) view returns (uint256[])",
  "function planCount() view returns (uint256)",
  "event PlanCreated(uint256 indexed planId, uint256 indexed merchantId, string name, uint256 priceInMUSD, uint8 planType, uint256 billingInterval)",
];

export const PROCESSOR_ABI = [
  "function subscribe(uint256 planId) returns (bytes32)",
  "function processPayment(address subscriber, uint256 planId) returns (bytes32)",
  "function cancelSubscription(uint256 planId)",
  "function getSubscription(address subscriber, uint256 planId) view returns (tuple(uint256 subscriptionId, uint256 planId, address subscriber, address merchant, uint256 priceInMUSD, uint256 nextPaymentDue, uint256 billingInterval, bool active, uint256 createdAt))",
  "function isSubscriptionActive(address subscriber, uint256 planId) view returns (bool)",
  "function getPlanSubscribers(uint256 planId) view returns (address[])",
  "function getPlanRevenue(uint256 planId) view returns (uint256)",
  "function isPaymentDue(address subscriber, uint256 planId) view returns (bool)",
  "event PaymentProcessed(bytes32 indexed paymentId, uint256 indexed planId, address indexed subscriber, address merchant, uint256 amount, uint256 timestamp)",
  "event SubscriptionCreated(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber, address merchant)",
  "event SubscriptionCancelled(uint256 indexed subscriptionId, uint256 indexed planId, address indexed subscriber)",
];

// Plan type helpers
export const PLAN_TYPES = {
  0: "One-Time",
  1: "Subscription",
  2: "Pay-Per-Use",
  ONE_TIME: 0,
  SUBSCRIPTION: 1,
  PAY_PER_USE: 2,
};

export const BILLING_INTERVALS = {
  "1 Hour": 3600,
  "1 Day": 86400,
  "1 Week": 604800,
  "30 Days": 2592000,
  "90 Days": 7776000,
  "1 Year": 31536000,
};
