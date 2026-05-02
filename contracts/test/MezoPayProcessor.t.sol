// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "../src/MezoPayRegistry.sol";
import "../src/MezoPayPlans.sol";
import "../src/MezoPayProcessor.sol";

/// @notice Mock MUSD token for testing
contract MockMUSD is ERC20 {
    constructor() ERC20("Mock MUSD", "MUSD") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

contract MezoPayTest is Test {
    MockMUSD musd;
    MezoPayRegistry registry;
    MezoPayPlans plans;
    MezoPayProcessor processor;

    address merchant = makeAddr("merchant");
    address subscriber = makeAddr("subscriber");
    address keeper = makeAddr("keeper");

    uint256 constant PLAN_PRICE = 10 ether; // 10 MUSD
    uint256 constant BILLING_INTERVAL = 30 days;

    function setUp() public {
        // Deploy mock MUSD
        musd = new MockMUSD();

        // Deploy MezoPay contracts
        registry = new MezoPayRegistry();
        plans = new MezoPayPlans(address(registry));
        processor = new MezoPayProcessor(address(musd), address(plans));

        // Fund subscriber with MUSD
        musd.mint(subscriber, 1000 ether);

        // Approve processor to spend subscriber's MUSD
        vm.prank(subscriber);
        musd.approve(address(processor), type(uint256).max);
    }

    // ─── Registry Tests ──────────────────────────────────────────────────

    function test_RegisterMerchant() public {
        vm.prank(merchant);
        uint256 merchantId = registry.registerMerchant("Test Shop", "https://example.com/webhook");

        assertEq(merchantId, 1);
        assertTrue(registry.isMerchant(merchant));
        assertEq(registry.merchantCount(), 1);

        IMezoPayTypes.Merchant memory m = registry.getMerchant(1);
        assertEq(m.wallet, merchant);
        assertEq(m.name, "Test Shop");
        assertEq(m.webhookUrl, "https://example.com/webhook");
        assertTrue(m.active);
    }

    function test_RegisterMerchant_RevertDuplicate() public {
        vm.prank(merchant);
        registry.registerMerchant("Test Shop", "");

        vm.prank(merchant);
        vm.expectRevert("MezoPayRegistry: already registered");
        registry.registerMerchant("Another Shop", "");
    }

    function test_RegisterMerchant_RevertEmptyName() public {
        vm.prank(merchant);
        vm.expectRevert("MezoPayRegistry: name required");
        registry.registerMerchant("", "");
    }

    function test_UpdateMerchant() public {
        vm.prank(merchant);
        uint256 merchantId = registry.registerMerchant("Old Name", "");

        vm.prank(merchant);
        registry.updateMerchant(merchantId, "New Name", "https://new-webhook.com");

        IMezoPayTypes.Merchant memory m = registry.getMerchant(merchantId);
        assertEq(m.name, "New Name");
        assertEq(m.webhookUrl, "https://new-webhook.com");
    }

    function test_UpdateMerchant_RevertNotOwner() public {
        vm.prank(merchant);
        uint256 merchantId = registry.registerMerchant("Test Shop", "");

        vm.prank(subscriber);
        vm.expectRevert("MezoPayRegistry: not owner");
        registry.updateMerchant(merchantId, "Hacked Name", "");
    }

    // ─── Plans Tests ─────────────────────────────────────────────────────

    function _registerMerchant() internal returns (uint256) {
        vm.prank(merchant);
        return registry.registerMerchant("Test Shop", "https://example.com/webhook");
    }

    function test_CreatePlan_OneTime() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        uint256 planId = plans.createPlan(
            merchantId,
            "Premium Access",
            PLAN_PRICE,
            IMezoPayTypes.PlanType.ONE_TIME,
            0
        );

        assertEq(planId, 1);

        IMezoPayTypes.Plan memory p = plans.getPlan(planId);
        assertEq(p.name, "Premium Access");
        assertEq(p.priceInMUSD, PLAN_PRICE);
        assertEq(uint256(p.planType), uint256(IMezoPayTypes.PlanType.ONE_TIME));
        assertEq(p.billingInterval, 0);
        assertTrue(p.active);
    }

    function test_CreatePlan_Subscription() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        uint256 planId = plans.createPlan(
            merchantId,
            "Monthly Pro",
            PLAN_PRICE,
            IMezoPayTypes.PlanType.SUBSCRIPTION,
            BILLING_INTERVAL
        );

        IMezoPayTypes.Plan memory p = plans.getPlan(planId);
        assertEq(uint256(p.planType), uint256(IMezoPayTypes.PlanType.SUBSCRIPTION));
        assertEq(p.billingInterval, BILLING_INTERVAL);
    }

    function test_CreatePlan_RevertNotMerchant() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(subscriber);
        vm.expectRevert("MezoPayPlans: not merchant owner");
        plans.createPlan(merchantId, "Fake Plan", PLAN_PRICE, IMezoPayTypes.PlanType.ONE_TIME, 0);
    }

    function test_CreatePlan_RevertZeroPrice() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        vm.expectRevert("MezoPayPlans: price must be > 0");
        plans.createPlan(merchantId, "Free Plan", 0, IMezoPayTypes.PlanType.ONE_TIME, 0);
    }

    function test_CreatePlan_RevertOneTimeWithInterval() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        vm.expectRevert("MezoPayPlans: ONE_TIME must have 0 interval");
        plans.createPlan(merchantId, "Bad Plan", PLAN_PRICE, IMezoPayTypes.PlanType.ONE_TIME, 100);
    }

    function test_CreatePlan_RevertSubscriptionNoInterval() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        vm.expectRevert("MezoPayPlans: recurring plans need interval > 0");
        plans.createPlan(merchantId, "Bad Sub", PLAN_PRICE, IMezoPayTypes.PlanType.SUBSCRIPTION, 0);
    }

    function test_DeactivatePlan() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        uint256 planId = plans.createPlan(merchantId, "Plan", PLAN_PRICE, IMezoPayTypes.PlanType.ONE_TIME, 0);

        vm.prank(merchant);
        plans.deactivatePlan(planId);

        IMezoPayTypes.Plan memory p = plans.getPlan(planId);
        assertFalse(p.active);
    }

    function test_DeactivatePlan_RevertNotOwner() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        uint256 planId = plans.createPlan(merchantId, "Plan", PLAN_PRICE, IMezoPayTypes.PlanType.ONE_TIME, 0);

        vm.prank(subscriber);
        vm.expectRevert("MezoPayPlans: not plan owner");
        plans.deactivatePlan(planId);
    }

    function test_GetMerchantPlans() public {
        uint256 merchantId = _registerMerchant();

        vm.startPrank(merchant);
        plans.createPlan(merchantId, "Plan 1", PLAN_PRICE, IMezoPayTypes.PlanType.ONE_TIME, 0);
        plans.createPlan(merchantId, "Plan 2", 20 ether, IMezoPayTypes.PlanType.SUBSCRIPTION, BILLING_INTERVAL);
        vm.stopPrank();

        uint256[] memory ids = plans.getMerchantPlans(merchantId);
        assertEq(ids.length, 2);
        assertEq(ids[0], 1);
        assertEq(ids[1], 2);
    }

    // ─── Processor Tests — One-Time Payment ──────────────────────────────

    function _setupOneTimePlan() internal returns (uint256 planId) {
        uint256 merchantId = _registerMerchant();
        vm.prank(merchant);
        planId = plans.createPlan(merchantId, "One-Time", PLAN_PRICE, IMezoPayTypes.PlanType.ONE_TIME, 0);
    }

    function test_OneTimePayment() public {
        uint256 planId = _setupOneTimePlan();

        uint256 merchantBalBefore = musd.balanceOf(merchant);
        uint256 subscriberBalBefore = musd.balanceOf(subscriber);

        vm.prank(subscriber);
        bytes32 paymentId = processor.subscribe(planId);

        assertTrue(paymentId != bytes32(0));
        assertEq(musd.balanceOf(merchant), merchantBalBefore + PLAN_PRICE);
        assertEq(musd.balanceOf(subscriber), subscriberBalBefore - PLAN_PRICE);

        // One-time payment should NOT create a subscription
        assertFalse(processor.isSubscriptionActive(subscriber, planId));
    }

    function test_OneTimePayment_RevertInactivePlan() public {
        uint256 planId = _setupOneTimePlan();

        vm.prank(merchant);
        plans.deactivatePlan(planId);

        vm.prank(subscriber);
        vm.expectRevert("MezoPayProcessor: plan inactive");
        processor.subscribe(planId);
    }

    // ─── Processor Tests — Subscription ──────────────────────────────────

    function _setupSubscriptionPlan() internal returns (uint256 planId) {
        uint256 merchantId = _registerMerchant();
        vm.prank(merchant);
        planId = plans.createPlan(
            merchantId, "Monthly Sub", PLAN_PRICE, IMezoPayTypes.PlanType.SUBSCRIPTION, BILLING_INTERVAL
        );
    }

    function test_SubscriptionPayment() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        // Check subscription was created
        assertTrue(processor.isSubscriptionActive(subscriber, planId));

        IMezoPayTypes.Subscription memory sub = processor.getSubscription(subscriber, planId);
        assertEq(sub.subscriber, subscriber);
        assertEq(sub.merchant, merchant);
        assertEq(sub.priceInMUSD, PLAN_PRICE);
        assertEq(sub.nextPaymentDue, block.timestamp + BILLING_INTERVAL);
        assertTrue(sub.active);

        // Check payment was made
        assertEq(musd.balanceOf(merchant), PLAN_PRICE);
    }

    function test_SubscriptionPayment_RevertDuplicate() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        vm.prank(subscriber);
        vm.expectRevert("MezoPayProcessor: already subscribed");
        processor.subscribe(planId);
    }

    function test_ProcessRecurringPayment() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        // First payment already made — merchant has PLAN_PRICE
        assertEq(musd.balanceOf(merchant), PLAN_PRICE);

        // Advance time past billing interval
        vm.warp(block.timestamp + BILLING_INTERVAL);

        // Anyone (keeper) can process the payment
        vm.prank(keeper);
        processor.processPayment(subscriber, planId);

        // Merchant should have 2x PLAN_PRICE
        assertEq(musd.balanceOf(merchant), PLAN_PRICE * 2);

        // Next payment should be pushed forward
        IMezoPayTypes.Subscription memory sub = processor.getSubscription(subscriber, planId);
        assertEq(sub.nextPaymentDue, block.timestamp + BILLING_INTERVAL);
    }

    function test_ProcessRecurringPayment_RevertNotDue() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        // Try to process before it's due
        vm.prank(keeper);
        vm.expectRevert("MezoPayProcessor: not due yet");
        processor.processPayment(subscriber, planId);
    }

    function test_CancelSubscription() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        assertTrue(processor.isSubscriptionActive(subscriber, planId));

        vm.prank(subscriber);
        processor.cancelSubscription(planId);

        assertFalse(processor.isSubscriptionActive(subscriber, planId));
    }

    function test_CancelSubscription_RevertNotSubscriber() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        vm.prank(merchant);
        vm.expectRevert("MezoPayProcessor: no subscription");
        processor.cancelSubscription(planId);
    }

    function test_CancelSubscription_PreventsProcessing() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        vm.prank(subscriber);
        processor.cancelSubscription(planId);

        vm.warp(block.timestamp + BILLING_INTERVAL);

        vm.prank(keeper);
        vm.expectRevert("MezoPayProcessor: subscription inactive");
        processor.processPayment(subscriber, planId);
    }

    // ─── Processor Tests — Pay Per Use ───────────────────────────────────

    function test_PayPerUse() public {
        uint256 merchantId = _registerMerchant();

        vm.prank(merchant);
        uint256 planId = plans.createPlan(
            merchantId, "API Call", 1 ether, IMezoPayTypes.PlanType.PAY_PER_USE, 1 hours
        );

        vm.prank(subscriber);
        processor.subscribe(planId);

        assertTrue(processor.isSubscriptionActive(subscriber, planId));
        assertEq(musd.balanceOf(merchant), 1 ether);
    }

    // ─── Revenue Tracking ────────────────────────────────────────────────

    function test_PlanRevenue() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        assertEq(processor.getPlanRevenue(planId), PLAN_PRICE);

        vm.warp(block.timestamp + BILLING_INTERVAL);
        vm.prank(keeper);
        processor.processPayment(subscriber, planId);

        assertEq(processor.getPlanRevenue(planId), PLAN_PRICE * 2);
    }

    function test_PlanSubscribers() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        address[] memory subs = processor.getPlanSubscribers(planId);
        assertEq(subs.length, 1);
        assertEq(subs[0], subscriber);
    }

    // ─── Edge Cases ──────────────────────────────────────────────────────

    function test_IsPaymentDue() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        assertFalse(processor.isPaymentDue(subscriber, planId));

        vm.warp(block.timestamp + BILLING_INTERVAL);
        assertTrue(processor.isPaymentDue(subscriber, planId));
    }

    function test_IsPaymentDue_NoSubscription() public {
        assertFalse(processor.isPaymentDue(subscriber, 999));
    }

    function test_ReSubscribeAfterCancel() public {
        uint256 planId = _setupSubscriptionPlan();

        vm.prank(subscriber);
        processor.subscribe(planId);

        vm.prank(subscriber);
        processor.cancelSubscription(planId);

        // Should be able to re-subscribe
        vm.prank(subscriber);
        processor.subscribe(planId);

        assertTrue(processor.isSubscriptionActive(subscriber, planId));
    }
}
