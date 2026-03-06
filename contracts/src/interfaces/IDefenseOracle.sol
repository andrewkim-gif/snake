// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDefenseOracle
 * @notice Interface for the Defense Oracle that maps market cap to defense multiplier
 */
interface IDefenseOracle {
    struct DefenseData {
        uint256 marketCap;
        uint256 defenseMultiplier; // basis points (10000 = 1.0x)
        uint256 lastUpdated;
        bool frozen;
    }

    event DefenseUpdated(string indexed iso3, uint256 marketCap, uint256 multiplier);
    event DefenseFrozen(string indexed iso3, uint256 previousCap, uint256 newCap);
    event DefenseUnfrozen(string indexed iso3);

    function getDefenseMultiplier(string calldata iso3) external view returns (uint256);
    function getDefenseData(string calldata iso3) external view returns (DefenseData memory);
    function updateMarketCap(string calldata iso3, uint256 newMarketCap) external;
    function batchUpdateMarketCaps(string[] calldata iso3s, uint256[] calldata caps) external;
}
