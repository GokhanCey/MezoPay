// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "./interfaces/IMezoPayTypes.sol";
import "./MezoPayPlans.sol";

/// @title MezoPayProcessor — Core payment engine for MezoPay
/// @notice Handles MUSD payments: one-time, subscriptions, and pay-per-use
/// @dev Uses SafeERC20 for token transfers and ReentrancyGuard for security
contract MezoPayProcessor is IMezoPayTypes, ReentrancyGuard {
    using SafeERC20 for IERC20;

    // ─── State ───────────────────────────────────────────────────────────

    IERC20 public immutable musd;
    MezoPayPlans public immutable plansContract;

    uint256 private _nextSubscriptionId = 1;
    uint256 private _paymentNonce = 1;

    /// @notice subscriptionId => Subscription
    mapping(uint256 => Subscription) public subscriptions;

    /// @notice subscriber => planId => subscriptionId (0 if none)
    mapping(address => mapping(uint256 => uint256)) public userSubscription;

    /// @notice Tracks processed payments to prevent double processing
    mapping(bytes32 => bool) public processedPayments;

    /// @notice planId => array of subscriber addresses
    mapping(uint256 => address[]) public planSubscribers;

    /// @notice planId => total revenue collected
    mapping(uint256 => uint256) public planRevenue;

    // ─── Constructor ─────────────────────────────────────────────────────

    constructor(address _musd, address _plansContract) {
        require(_musd != address(0), "MezoPayProcessor: invalid MUSD");
        require(_plansContract != address(0), "MezoPayProcessor: invalid plans");
        musd = IERC20(_musd);
        plansContract = MezoPayPlans(_plansContract);
    }

    // ─── External Functions ──────────────────────────────────────────────

    /// @notice Subscribe to a plan / make a one-time payment
    /// @dev User must have approved MUSD spending before calling
    /// @param planId The plan to subscribe to
    /// @return paymentId Unique payment identifier
    function subscribe(uint256 planId) external nonReentrant returns (bytes32 paymentId) {
        Plan memory plan = plansContract.getPlan(planId);
        require(plan.active, "MezoPayProcessor: plan inactive");

        // For subscriptions, check user doesn't already have an active subscription
        if (plan.planType == PlanType.SUBSCRIPTION) {
            uint256 existingSub = userSubscription[msg.sender][planId];
            if (existingSub != 0) {
                require(!subscriptions[existingSub].active, "MezoPayProcessor: already subscribed");
            }
        }

        // Generate unique payment ID
        paymentId = keccak256(
            abi.encodePacked(msg.sender, planId, block.timestamp, block.number, _paymentNonce++)
        );
        require(!processedPayments[paymentId], "MezoPayProcessor: duplicate payment");
        processedPayments[paymentId] = true;

        // Transfer MUSD from subscriber to merchant
        musd.safeTransferFrom(msg.sender, plan.merchantWallet, plan.priceInMUSD);

        // Track revenue
        planRevenue[planId] += plan.priceInMUSD;

        emit PaymentProcessed(
            paymentId,
            planId,
            msg.sender,
            plan.merchantWallet,
            plan.priceInMUSD,
            block.timestamp
        );

        // For recurring plans, create a subscription record
        if (plan.planType == PlanType.SUBSCRIPTION || plan.planType == PlanType.PAY_PER_USE) {
            uint256 subId = _nextSubscriptionId++;

            subscriptions[subId] = Subscription({
                subscriptionId: subId,
                planId: planId,
                subscriber: msg.sender,
                merchant: plan.merchantWallet,
                priceInMUSD: plan.priceInMUSD,
                nextPaymentDue: block.timestamp + plan.billingInterval,
                billingInterval: plan.billingInterval,
                active: true,
                createdAt: block.timestamp
            });

            userSubscription[msg.sender][planId] = subId;
            planSubscribers[planId].push(msg.sender);

            emit SubscriptionCreated(subId, planId, msg.sender, plan.merchantWallet);
        }
    }

    /// @notice Process a recurring payment when it's due
    /// @dev Callable by anyone — acts as a keeper/crank
    /// @param subscriber The subscriber whose payment is due
    /// @param planId The plan to process payment for
    /// @return paymentId Unique payment identifier
    function processPayment(address subscriber, uint256 planId)
        external
        nonReentrant
        returns (bytes32 paymentId)
    {
        uint256 subId = userSubscription[subscriber][planId];
        require(subId != 0, "MezoPayProcessor: no subscription");

        Subscription storage sub = subscriptions[subId];
        require(sub.active, "MezoPayProcessor: subscription inactive");
        require(block.timestamp >= sub.nextPaymentDue, "MezoPayProcessor: not due yet");

        // Generate unique payment ID
        paymentId = keccak256(
            abi.encodePacked(subscriber, planId, block.timestamp, block.number, "recurring", _paymentNonce++)
        );
        require(!processedPayments[paymentId], "MezoPayProcessor: duplicate payment");
        processedPayments[paymentId] = true;

        // Transfer MUSD from subscriber to merchant
        musd.safeTransferFrom(subscriber, sub.merchant, sub.priceInMUSD);

        // Update next payment due
        sub.nextPaymentDue += sub.billingInterval;

        // Track revenue
        planRevenue[planId] += sub.priceInMUSD;

        emit PaymentProcessed(
            paymentId,
            planId,
            subscriber,
            sub.merchant,
            sub.priceInMUSD,
            block.timestamp
        );
    }

    /// @notice Cancel a subscription (only the subscriber can cancel)
    /// @param planId The plan to cancel subscription for
    function cancelSubscription(uint256 planId) external {
        uint256 subId = userSubscription[msg.sender][planId];
        require(subId != 0, "MezoPayProcessor: no subscription");

        Subscription storage sub = subscriptions[subId];
        require(sub.subscriber == msg.sender, "MezoPayProcessor: not subscriber");
        require(sub.active, "MezoPayProcessor: already cancelled");

        sub.active = false;

        emit SubscriptionCancelled(subId, planId, msg.sender);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get subscription details
    function getSubscription(address subscriber, uint256 planId)
        external
        view
        returns (Subscription memory)
    {
        uint256 subId = userSubscription[subscriber][planId];
        require(subId != 0, "MezoPayProcessor: no subscription");
        return subscriptions[subId];
    }

    /// @notice Check if a subscription is active
    function isSubscriptionActive(address subscriber, uint256 planId)
        external
        view
        returns (bool)
    {
        uint256 subId = userSubscription[subscriber][planId];
        if (subId == 0) return false;
        return subscriptions[subId].active;
    }

    /// @notice Get all subscribers for a plan
    function getPlanSubscribers(uint256 planId)
        external
        view
        returns (address[] memory)
    {
        return planSubscribers[planId];
    }

    /// @notice Get total revenue for a plan
    function getPlanRevenue(uint256 planId) external view returns (uint256) {
        return planRevenue[planId];
    }

    /// @notice Get subscription count
    function subscriptionCount() external view returns (uint256) {
        return _nextSubscriptionId - 1;
    }

    /// @notice Check if a payment is due for a subscription
    function isPaymentDue(address subscriber, uint256 planId) external view returns (bool) {
        uint256 subId = userSubscription[subscriber][planId];
        if (subId == 0) return false;
        Subscription memory sub = subscriptions[subId];
        return sub.active && block.timestamp >= sub.nextPaymentDue;
    }
}
