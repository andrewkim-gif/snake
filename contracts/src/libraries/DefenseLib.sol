// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title DefenseLib
 * @notice Pure library for defense multiplier calculations
 * @dev Market cap thresholds map to defense multiplier tiers (basis points)
 *
 * Tier thresholds (in USD-equivalent):
 *   0      -> 10K   : 1.0x  (10000 bp)
 *   10K    -> 100K  : 1.2x  (12000 bp)
 *   100K   -> 1M    : 1.5x  (15000 bp)
 *   1M     -> 10M   : 2.0x  (20000 bp)
 *   10M    -> 100M  : 3.0x  (30000 bp)
 *   100M+           : 5.0x  (50000 bp)
 */
library DefenseLib {
    uint256 internal constant BP_BASE = 10_000;

    // Market cap thresholds (18 decimals)
    uint256 internal constant TIER_1 = 10_000e18;
    uint256 internal constant TIER_2 = 100_000e18;
    uint256 internal constant TIER_3 = 1_000_000e18;
    uint256 internal constant TIER_4 = 10_000_000e18;
    uint256 internal constant TIER_5 = 100_000_000e18;

    // Multipliers in basis points
    uint256 internal constant MULT_0 = 10_000;  // 1.0x
    uint256 internal constant MULT_1 = 12_000;  // 1.2x
    uint256 internal constant MULT_2 = 15_000;  // 1.5x
    uint256 internal constant MULT_3 = 20_000;  // 2.0x
    uint256 internal constant MULT_4 = 30_000;  // 3.0x
    uint256 internal constant MULT_5 = 50_000;  // 5.0x

    // Circuit breaker: 30% change in 5 min triggers freeze
    uint256 internal constant CIRCUIT_BREAKER_PCT = 30;

    /**
     * @notice Calculate defense multiplier from market cap
     * @param marketCap Token market cap (18 decimals)
     * @return multiplier in basis points (10000 = 1.0x)
     */
    function calcMultiplier(uint256 marketCap) internal pure returns (uint256) {
        if (marketCap >= TIER_5) return MULT_5;
        if (marketCap >= TIER_4) return MULT_4;
        if (marketCap >= TIER_3) return MULT_3;
        if (marketCap >= TIER_2) return MULT_2;
        if (marketCap >= TIER_1) return MULT_1;
        return MULT_0;
    }

    /**
     * @notice Check if market cap change triggers circuit breaker
     * @param oldCap Previous market cap
     * @param newCap New market cap
     * @return shouldFreeze Whether the defense buff should be frozen
     */
    function shouldTripCircuitBreaker(
        uint256 oldCap,
        uint256 newCap
    ) internal pure returns (bool) {
        if (oldCap == 0) return false;
        uint256 diff = newCap > oldCap ? newCap - oldCap : oldCap - newCap;
        return (diff * 100) / oldCap >= CIRCUIT_BREAKER_PCT;
    }
}
