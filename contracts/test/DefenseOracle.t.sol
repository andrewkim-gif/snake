// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/DefenseOracle.sol";
import "../src/libraries/DefenseLib.sol";

contract DefenseOracleTest is Test {
    DefenseOracle oracle;

    function setUp() public {
        oracle = new DefenseOracle();
    }

    function test_initialMultiplier() public view {
        uint256 m = oracle.getDefenseMultiplier("USA");
        assertEq(m, 10_000); // 1.0x base
    }

    function test_tier1_multiplier() public {
        oracle.updateMarketCap("USA", 50_000e18); // 50K between TIER_1 and TIER_2
        assertEq(oracle.getDefenseMultiplier("USA"), 12_000); // 1.2x
    }

    function test_tier5_multiplier() public {
        oracle.updateMarketCap("USA", 200_000_000e18); // 200M > TIER_5
        assertEq(oracle.getDefenseMultiplier("USA"), 50_000); // 5.0x
    }

    function test_circuitBreaker_freezes() public {
        oracle.updateMarketCap("USA", 1_000_000e18); // 1M
        // Jump 40% -> should trigger circuit breaker
        oracle.updateMarketCap("USA", 1_400_000e18);

        // During freeze, returns base multiplier
        assertEq(oracle.getDefenseMultiplier("USA"), 10_000);

        IDefenseOracle.DefenseData memory d = oracle.getDefenseData("USA");
        assertTrue(d.frozen);
    }

    function test_circuitBreaker_autoUnfreeze() public {
        oracle.updateMarketCap("USA", 1_000_000e18);
        oracle.updateMarketCap("USA", 1_400_000e18); // freeze

        // Fast forward past freeze duration
        vm.warp(block.timestamp + 1 hours + 1);

        oracle.updateMarketCap("USA", 1_450_000e18); // small change, should unfreeze
        assertEq(oracle.getDefenseMultiplier("USA"), 20_000); // 2.0x for 1.45M
    }

    function test_batchUpdate() public {
        string[] memory iso3s = new string[](2);
        uint256[] memory caps = new uint256[](2);
        iso3s[0] = "USA"; caps[0] = 50_000_000e18;
        iso3s[1] = "CHN"; caps[1] = 500_000e18;

        oracle.batchUpdateMarketCaps(iso3s, caps);
        assertEq(oracle.getDefenseMultiplier("USA"), 30_000); // 3.0x
        assertEq(oracle.getDefenseMultiplier("CHN"), 15_000); // 1.5x
    }

    function test_onlyUpdater() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert(DefenseOracle.NotAuthorized.selector);
        oracle.updateMarketCap("USA", 1e18);
    }

    function test_manualUnfreeze() public {
        oracle.updateMarketCap("USA", 1_000_000e18);
        oracle.updateMarketCap("USA", 1_400_000e18); // freeze
        oracle.manualUnfreeze("USA");

        IDefenseOracle.DefenseData memory d = oracle.getDefenseData("USA");
        assertFalse(d.frozen);
    }
}
