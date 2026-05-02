// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "./interfaces/IMezoPayTypes.sol";

/// @title MezoPayRegistry — Merchant registration for MezoPay
/// @notice Allows merchants to register their business on-chain
/// @dev Merchant wallet is msg.sender — one merchant per address
contract MezoPayRegistry is IMezoPayTypes {
    // ─── State ───────────────────────────────────────────────────────────

    uint256 private _nextMerchantId = 1;

    /// @notice merchantId => Merchant
    mapping(uint256 => Merchant) public merchants;

    /// @notice wallet address => merchantId (0 if not registered)
    mapping(address => uint256) public merchantByWallet;

    // ─── External Functions ──────────────────────────────────────────────

    /// @notice Register as a merchant
    /// @param name Business name
    /// @param webhookUrl URL for payment notifications
    /// @return merchantId The assigned merchant ID
    function registerMerchant(string calldata name, string calldata webhookUrl)
        external
        returns (uint256 merchantId)
    {
        require(merchantByWallet[msg.sender] == 0, "MezoPayRegistry: already registered");
        require(bytes(name).length > 0, "MezoPayRegistry: name required");

        merchantId = _nextMerchantId++;

        merchants[merchantId] = Merchant({
            merchantId: merchantId,
            wallet: msg.sender,
            name: name,
            webhookUrl: webhookUrl,
            active: true,
            createdAt: block.timestamp
        });

        merchantByWallet[msg.sender] = merchantId;

        emit MerchantRegistered(merchantId, msg.sender, name);
    }

    /// @notice Update merchant details (only the merchant can update their own record)
    /// @param merchantId The merchant to update
    /// @param name New business name
    /// @param webhookUrl New webhook URL
    function updateMerchant(uint256 merchantId, string calldata name, string calldata webhookUrl) external {
        Merchant storage m = merchants[merchantId];
        require(m.wallet == msg.sender, "MezoPayRegistry: not owner");
        require(bytes(name).length > 0, "MezoPayRegistry: name required");

        m.name = name;
        m.webhookUrl = webhookUrl;

        emit MerchantUpdated(merchantId, name, webhookUrl);
    }

    // ─── View Functions ──────────────────────────────────────────────────

    /// @notice Get merchant details by ID
    function getMerchant(uint256 merchantId) external view returns (Merchant memory) {
        require(merchants[merchantId].wallet != address(0), "MezoPayRegistry: not found");
        return merchants[merchantId];
    }

    /// @notice Check if an address is a registered merchant
    function isMerchant(address wallet) external view returns (bool) {
        return merchantByWallet[wallet] != 0;
    }

    /// @notice Get merchantId for a wallet address
    function getMerchantIdByWallet(address wallet) external view returns (uint256) {
        return merchantByWallet[wallet];
    }

    /// @notice Get the total number of registered merchants
    function merchantCount() external view returns (uint256) {
        return _nextMerchantId - 1;
    }
}
