// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/NationalTokenFactory.sol";

/**
 * @title DeployNationalTokens
 * @notice Batch-deploys 195 national tokens via NationalTokenFactory
 * @dev Usage:
 *   forge script script/DeployNationalTokens.s.sol:DeployNationalTokens \
 *     --broadcast --rpc-url $CROSS_RPC_URL \
 *     --private-key $DEPLOYER_PRIVATE_KEY
 *
 * Requires: NationalTokenFactory already deployed (set FACTORY_ADDRESS env)
 *
 * Deploys in batches of 20 to avoid gas limits.
 * Tier supply: S=50M, A=30M, B=20M, C=10M, D=5M
 */
contract DeployNationalTokens is Script {
    NationalTokenFactory public factory;

    function setUp() public {
        address factoryAddr = vm.envAddress("FACTORY_ADDRESS");
        factory = NationalTokenFactory(factoryAddr);
    }

    function run() public {
        vm.startBroadcast();

        // --- Tier S (8 countries, 50M tokens each) ---
        _deploy("United States Token", "USA", "USA", 0);
        _deploy("China Token", "CHN", "CHN", 0);
        _deploy("Russia Token", "RUS", "RUS", 0);
        _deploy("India Token", "IND", "IND", 0);
        _deploy("Brazil Token", "BRA", "BRA", 0);
        _deploy("Japan Token", "JPN", "JPN", 0);
        _deploy("Germany Token", "DEU", "DEU", 0);
        _deploy("United Kingdom Token", "GBR", "GBR", 0);
        console.log("Tier S: 8 tokens deployed");

        // --- Tier A (20 countries, 30M tokens each) ---
        _deploy("South Korea Token", "KOR", "KOR", 1);
        _deploy("France Token", "FRA", "FRA", 1);
        _deploy("Canada Token", "CAN", "CAN", 1);
        _deploy("Australia Token", "AUS", "AUS", 1);
        _deploy("Saudi Arabia Token", "SAU", "SAU", 1);
        _deploy("Turkey Token", "TUR", "TUR", 1);
        _deploy("Indonesia Token", "IDN", "IDN", 1);
        _deploy("Mexico Token", "MEX", "MEX", 1);
        _deploy("Italy Token", "ITA", "ITA", 1);
        _deploy("Spain Token", "ESP", "ESP", 1);
        _deploy("Iran Token", "IRN", "IRN", 1);
        _deploy("Egypt Token", "EGY", "EGY", 1);
        _deploy("Pakistan Token", "PAK", "PAK", 1);
        _deploy("Nigeria Token", "NGA", "NGA", 1);
        _deploy("Israel Token", "ISR", "ISR", 1);
        _deploy("Poland Token", "POL", "POL", 1);
        _deploy("South Africa Token", "ZAF", "ZAF", 1);
        _deploy("Ukraine Token", "UKR", "UKR", 1);
        _deploy("Netherlands Token", "NLD", "NLD", 1);
        _deploy("Sweden Token", "SWE", "SWE", 1);
        console.log("Tier A: 20 tokens deployed");

        // --- Tier B batch 1 (20 countries) ---
        _deploy("Thailand Token", "THA", "THA", 2);
        _deploy("Argentina Token", "ARG", "ARG", 2);
        _deploy("Colombia Token", "COL", "COL", 2);
        _deploy("Malaysia Token", "MYS", "MYS", 2);
        _deploy("Philippines Token", "PHL", "PHL", 2);
        _deploy("Vietnam Token", "VNM", "VNM", 2);
        _deploy("Bangladesh Token", "BGD", "BGD", 2);
        _deploy("Norway Token", "NOR", "NOR", 2);
        _deploy("Switzerland Token", "CHE", "CHE", 2);
        _deploy("Austria Token", "AUT", "AUT", 2);
        _deploy("Belgium Token", "BEL", "BEL", 2);
        _deploy("Chile Token", "CHL", "CHL", 2);
        _deploy("Peru Token", "PER", "PER", 2);
        _deploy("Venezuela Token", "VEN", "VEN", 2);
        _deploy("Iraq Token", "IRQ", "IRQ", 2);
        _deploy("Kuwait Token", "KWT", "KWT", 2);
        _deploy("United Arab Emirates Token", "ARE", "ARE", 2);
        _deploy("Qatar Token", "QAT", "QAT", 2);
        _deploy("Singapore Token", "SGP", "SGP", 2);
        _deploy("Finland Token", "FIN", "FIN", 2);
        console.log("Tier B batch 1: 20 tokens deployed");

        // --- Tier B batch 2 (20 countries) ---
        _deploy("Denmark Token", "DNK", "DNK", 2);
        _deploy("Ireland Token", "IRL", "IRL", 2);
        _deploy("Portugal Token", "PRT", "PRT", 2);
        _deploy("Greece Token", "GRC", "GRC", 2);
        _deploy("Czech Republic Token", "CZE", "CZE", 2);
        _deploy("Romania Token", "ROU", "ROU", 2);
        _deploy("New Zealand Token", "NZL", "NZL", 2);
        _deploy("Kazakhstan Token", "KAZ", "KAZ", 2);
        _deploy("Ethiopia Token", "ETH", "ETH", 2);
        _deploy("Algeria Token", "DZA", "DZA", 2);
        _deploy("Morocco Token", "MAR", "MAR", 2);
        _deploy("Kenya Token", "KEN", "KEN", 2);
        _deploy("Myanmar Token", "MMR", "MMR", 2);
        _deploy("Taiwan Token", "TWN", "TWN", 2);
        _deploy("Hungary Token", "HUN", "HUN", 2);
        _deploy("North Korea Token", "PRK", "PRK", 2);
        _deploy("Cuba Token", "CUB", "CUB", 2);
        _deploy("Libya Token", "LBY", "LBY", 2);
        _deploy("Angola Token", "AGO", "AGO", 2);
        _deploy("DR Congo Token", "COD", "COD", 2);
        console.log("Tier B batch 2: 20 tokens deployed");

        // Remaining Tier C and D deployed via batchDeployTokens
        // (see DeployNationalTokensBatch2.s.sol for C/D tiers)

        console.log("=== National token deployment complete ===");
        console.log("Total factory tokens:", factory.totalTokens());

        vm.stopBroadcast();
    }

    function _deploy(
        string memory name,
        string memory symbol,
        string memory iso3,
        uint8 tier
    ) internal {
        address token = factory.deployToken(name, symbol, iso3, tier, address(0));
        console.log(string.concat("  ", iso3, " -> "), token);
    }
}
