// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/// @title IMezoPayTypes — Shared types for the MezoPay protocol
/// @notice Defines enums, structs, and events used across all MezoPay contracts
interface IMezoPayTypes {
    // ─── Enums ───────────────────────────────────────────────────────────

    enum PlanType {
        ONE_TIME,
        SUBSCRIPTION,
        PAY_PER_USE
    }

    // ─── Structs ─────────────────────────────────────────────────────────

    struct Merchant {
        uint256 merchantId;
        address wallet;
        string name;
        string webhookUrl;
        bool active;
        uint256 createdAt;
    }

    struct Plan {
        uint256 planId;
        uint256 merchantId;
        address merchantWallet;
        string name;
        uint256 priceInMUSD; // 18 decimals
        PlanType planType;
        uint256 billingInterval; // seconds (0 for ONE_TIME)
        bool active;
        uint256 createdAt;
    }

    struct Subscription {
        uint256 subscriptionId;
        uint256 planId;
        address subscriber;
        address merchant;
        uint256 priceInMUSD;
        uint256 nextPaymentDue;
        uint256 billingInterval;
        bool active;
        uint256 createdAt;
    }

    // ─── Events ──────────────────────────────────────────────────────────

    event MerchantRegistered(
        uint256 indexed merchantId,
        address indexed wallet,
        string name
    );

    event MerchantUpdated(
        uint256 indexed merchantId,
        string name,
        string webhookUrl
    );

    event PlanCreated(
        uint256 indexed planId,
        uint256 indexed merchantId,
        string name,
        uint256 priceInMUSD,
        PlanType planType,
        uint256 billingInterval
    );

    event PlanDeactivated(uint256 indexed planId);

    event PaymentProcessed(
        bytes32 indexed paymentId,
        uint256 indexed planId,
        address indexed subscriber,
        address merchant,
        uint256 amount,
        uint256 timestamp
    );

    event SubscriptionCreated(
        uint256 indexed subscriptionId,
        uint256 indexed planId,
        address indexed subscriber,
        address merchant
    );

    event SubscriptionCancelled(
        uint256 indexed subscriptionId,
        uint256 indexed planId,
        address indexed subscriber
    );
}
