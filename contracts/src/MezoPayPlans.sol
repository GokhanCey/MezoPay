// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IMezoPayTypes.sol";
import "./MezoPayRegistry.sol";

/// @title MezoPayPlans — Payment plan management for MezoPay
/// @notice Merchants create payment plans (one-time, subscription, pay-per-use)
contract MezoPayPlans is IMezoPayTypes {
    // ─── State ───────────────────────────────────────────────────────────

    MezoPayRegistry public immutable registry;

    uint256 private _nextPlanId = 1;

    /// @notice planId => Plan
    mapping(uint256 => Plan) public plans;

    /// @notice merchantId => array of planIds
    mapping(uint256 => uint256[]) public merchantPlans;

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(address _registry) {
        require(_registry != address(0), "MezoPayPlans: invalid registry");
        registry = MezoPayRegistry(_registry);
    }

    // ─── External Functions ──────────────────────────────────────────────

    /// @notice Create a new payment plan
    /// @param merchantId The merchant creating this plan (must match msg.sender)
    /// @param name Plan display name
    /// @param priceInMUSD Price in MUSD (18 decimals)
    /// @param planType ONE_TIME (0), SUBSCRIPTION (1), or PAY_PER_USE (2)
    /// @param billingInterval Seconds between payments (0 for ONE_TIME)
    /// @return planId The assigned plan ID
    function createPlan(
        uint256 merchantId,
        string calldata name,
        uint256 priceInMUSD,
        PlanType planType,
        uint256 billingInterval
    ) external returns (uint256 planId) {
        // Verify caller is the merchant
        IMezoPayTypes.Merchant memory merchant = registry.getMerchant(merchantId);
        require(merchant.wallet == msg.sender, "MezoPayPlans: not merchant owner");
        require(bytes(name).length > 0, "MezoPayPlans: name required");
        require(priceInMUSD > 0, "MezoPayPlans: price must be > 0");

        // Validate billing interval matches plan type
        if (planType == PlanType.ONE_TIME) {
            require(billingInterval == 0, "MezoPayPlans: ONE_TIME must have 0 interval");
        } else {
            require(billingInterval > 0, "MezoPayPlans: recurring plans need interval > 0");
        }

        planId = _nextPlanId++;

        plans[planId] = Plan({
            planId: planId,
            merchantId: merchantId,
            merchantWallet: msg.sender,
            name: name,
            priceInMUSD: priceInMUSD,
            planType: planType,
            billingInterval: billingInterval,
            active: true,
            createdAt: block.timestamp
        });

        merchantPlans[merchantId].push(planId);

        emit PlanCreated(planId, merchantId, name, priceInMUSD, planType, billingInterval);
    }

    /// @notice Deactivate a plan (only merchant can deactivate their own plans)
    /// @param planId The plan to deactivate
    function deactivatePlan(uint256 planId) external {
        Plan storage plan = plans[planId];
        require(plan.merchantWallet == msg.sender, "MezoPayPlans: not plan owner");
        require(plan.active, "MezoPayPlans: already inactive");

        plan.active = false;

        emit PlanDeactivated(planId);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get plan details by ID
    function getPlan(uint256 planId) external view returns (Plan memory) {
        require(plans[planId].merchantWallet != address(0), "MezoPayPlans: not found");
        return plans[planId];
    }

    /// @notice Get all plan IDs for a merchant
    function getMerchantPlans(uint256 merchantId) external view returns (uint256[] memory) {
        return merchantPlans[merchantId];
    }

    /// @notice Get total number of plans
    function planCount() external view returns (uint256) {
        return _nextPlanId - 1;
    }
}
