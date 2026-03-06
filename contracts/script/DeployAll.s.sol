// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/AWWToken.sol";
import "../src/NationalTokenFactory.sol";
import "../src/NationalTreasury.sol";
import "../src/DefenseOracle.sol";
import "../src/GovernanceModule.sol";

/**
 * @title DeployAll
 * @notice Foundry script to deploy the full AI World War token ecosystem
 * @dev Usage:
 *   forge script script/DeployAll.s.sol:DeployAll \
 *     --broadcast --rpc-url $CROSS_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY
 *
 * Deployment order:
 *   1. AWWToken (master governance token)
 *   2. NationalTokenFactory (195-country token deployer)
 *   3. DefenseOracle (market cap -> defense multiplier)
 *   4. GovernanceModule (quadratic voting)
 */
contract DeployAll is Script {
    // Wallet addresses (set via env or override)
    address public deployer;
    address public ecosystemWallet;
    address public communityWallet;
    address public teamWallet;
    address public liquidityWallet;
    address public treasuryWallet;

    function setUp() public {
        deployer = msg.sender;
        // Default: deployer acts as all wallets (override in production)
        ecosystemWallet = vm.envOr("ECOSYSTEM_WALLET", deployer);
        communityWallet = vm.envOr("COMMUNITY_WALLET", deployer);
        teamWallet = vm.envOr("TEAM_WALLET", deployer);
        liquidityWallet = vm.envOr("LIQUIDITY_WALLET", deployer);
        treasuryWallet = vm.envOr("TREASURY_WALLET", deployer);
    }

    function run() public {
        vm.startBroadcast();

        // 1. Deploy AWWToken
        AWWToken awwToken = new AWWToken(
            ecosystemWallet,
            communityWallet,
            teamWallet,
            liquidityWallet,
            treasuryWallet
        );
        console.log("AWWToken deployed at:", address(awwToken));

        // 2. Deploy NationalTokenFactory
        NationalTokenFactory factory = new NationalTokenFactory(treasuryWallet);
        console.log("NationalTokenFactory deployed at:", address(factory));

        // 3. Deploy DefenseOracle
        DefenseOracle oracle = new DefenseOracle();
        console.log("DefenseOracle deployed at:", address(oracle));

        // 4. Deploy GovernanceModule
        GovernanceModule governance = new GovernanceModule();
        console.log("GovernanceModule deployed at:", address(governance));

        vm.stopBroadcast();

        // Log summary
        console.log("--- Deployment Summary ---");
        console.log("AWWToken:             ", address(awwToken));
        console.log("NationalTokenFactory: ", address(factory));
        console.log("DefenseOracle:        ", address(oracle));
        console.log("GovernanceModule:     ", address(governance));
    }
}
