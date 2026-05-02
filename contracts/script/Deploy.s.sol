// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/MezoPayRegistry.sol";
import "../src/MezoPayPlans.sol";
import "../src/MezoPayProcessor.sol";

/// @title MezoPay Deployment Script
/// @notice Deploys all MezoPay contracts to Mezo testnet or mainnet
/// @dev Usage:
///   Testnet: forge script script/Deploy.s.sol --rpc-url mezo_testnet --broadcast --verify
///   Mainnet: forge script script/Deploy.s.sol --rpc-url mezo_mainnet --broadcast --verify
contract Deploy is Script {
    // MUSD Token Addresses
    address constant MUSD_TESTNET = 0x637e22A1EBbca50EA2d34027c238317fD10003eB;
    address constant MUSD_MAINNET = 0xdD468A1DDc392dcdbEf6db6e34E89AA338F9F186;

    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");
        uint256 chainId = block.chainid;

        // Select MUSD address based on chain
        address musdAddress;
        if (chainId == 31611) {
            musdAddress = MUSD_TESTNET;
            console.log("Deploying to Mezo TESTNET (Chain ID: 31611)");
        } else if (chainId == 31612) {
            musdAddress = MUSD_MAINNET;
            console.log("Deploying to Mezo MAINNET (Chain ID: 31612)");
        } else {
            revert("Unsupported chain ID. Use 31611 (testnet) or 31612 (mainnet)");
        }

        console.log("MUSD Token:", musdAddress);
        console.log("");

        vm.startBroadcast(deployerPrivateKey);

        // 1. Deploy Registry
        MezoPayRegistry registry = new MezoPayRegistry();
        console.log("MezoPayRegistry deployed at:", address(registry));

        // 2. Deploy Plans (depends on Registry)
        MezoPayPlans plans = new MezoPayPlans(address(registry));
        console.log("MezoPayPlans deployed at:", address(plans));

        // 3. Deploy Processor (depends on Plans + MUSD)
        MezoPayProcessor processor = new MezoPayProcessor(musdAddress, address(plans));
        console.log("MezoPayProcessor deployed at:", address(processor));

        vm.stopBroadcast();

        console.log("");
        console.log("=== Deployment Complete ===");
        console.log("Registry:  ", address(registry));
        console.log("Plans:     ", address(plans));
        console.log("Processor: ", address(processor));
        console.log("");
        console.log("Next steps:");
        console.log("1. Update frontend/src/config/contracts.js with these addresses");
        console.log("2. Update backend/.env with these addresses");
    }
}
