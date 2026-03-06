// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./NationalToken.sol";

/**
 * @title NationalTokenFactory
 * @notice Factory contract to deploy ERC-20 tokens for 195 countries
 * @dev Each country gets a unique NationalToken with tier-based initial supply
 *
 * Tier supply:
 *   S: 50M tokens  |  A: 30M  |  B: 20M  |  C: 10M  |  D: 5M
 */
contract NationalTokenFactory is Ownable {
    // --- Storage ---
    mapping(string => address) public tokensByISO3;
    address[] public allTokens;
    address public defaultTreasury;

    // Tier -> initial supply (18 decimals)
    mapping(uint8 => uint256) public tierSupply;

    // --- Events ---
    event TokenDeployed(
        string indexed iso3,
        address token,
        uint8 tier,
        uint256 supply,
        address treasury
    );
    event DefaultTreasuryUpdated(address newTreasury);

    // --- Errors ---
    error TokenAlreadyExists(string iso3);
    error ZeroAddress();
    error InvalidTier(uint8 tier);
    error ArrayLengthMismatch();

    constructor(address _defaultTreasury) Ownable(msg.sender) {
        if (_defaultTreasury == address(0)) revert ZeroAddress();
        defaultTreasury = _defaultTreasury;

        // S=50M, A=30M, B=20M, C=10M, D=5M (18 decimals)
        tierSupply[0] = 50_000_000e18; // S
        tierSupply[1] = 30_000_000e18; // A
        tierSupply[2] = 20_000_000e18; // B
        tierSupply[3] = 10_000_000e18; // C
        tierSupply[4] =  5_000_000e18; // D
    }

    /**
     * @notice Deploy a single country token
     * @param name Token name (e.g. "United States Dollar")
     * @param symbol Token symbol / ISO3 (e.g. "USA")
     * @param iso3 ISO 3166-1 alpha-3 code
     * @param tier Country tier (0=S, 1=A, 2=B, 3=C, 4=D)
     * @param treasury Override treasury (address(0) uses default)
     */
    function deployToken(
        string calldata name,
        string calldata symbol,
        string calldata iso3,
        uint8 tier,
        address treasury
    ) external onlyOwner returns (address) {
        if (tokensByISO3[iso3] != address(0)) revert TokenAlreadyExists(iso3);
        if (tier > 4) revert InvalidTier(tier);

        address treas = treasury == address(0) ? defaultTreasury : treasury;
        uint256 supply = tierSupply[tier];

        NationalToken token = new NationalToken(
            name, symbol, iso3, tier, supply, treas
        );

        tokensByISO3[iso3] = address(token);
        allTokens.push(address(token));

        emit TokenDeployed(iso3, address(token), tier, supply, treas);
        return address(token);
    }

    /**
     * @notice Batch deploy multiple country tokens
     */
    function batchDeployTokens(
        string[] calldata names,
        string[] calldata symbols,
        string[] calldata iso3s,
        uint8[] calldata tiers,
        address[] calldata treasuries
    ) external onlyOwner {
        uint256 len = names.length;
        if (
            symbols.length != len ||
            iso3s.length != len ||
            tiers.length != len ||
            treasuries.length != len
        ) revert ArrayLengthMismatch();

        for (uint256 i; i < len; ++i) {
            if (tokensByISO3[iso3s[i]] != address(0)) revert TokenAlreadyExists(iso3s[i]);
            if (tiers[i] > 4) revert InvalidTier(tiers[i]);

            address treas = treasuries[i] == address(0) ? defaultTreasury : treasuries[i];
            uint256 supply = tierSupply[tiers[i]];

            NationalToken token = new NationalToken(
                names[i], symbols[i], iso3s[i], tiers[i], supply, treas
            );

            tokensByISO3[iso3s[i]] = address(token);
            allTokens.push(address(token));

            emit TokenDeployed(iso3s[i], address(token), tiers[i], supply, treas);
        }
    }

    /**
     * @notice Get total number of deployed tokens
     */
    function totalTokens() external view returns (uint256) {
        return allTokens.length;
    }

    /**
     * @notice Update default treasury for future deployments
     */
    function setDefaultTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        defaultTreasury = newTreasury;
        emit DefaultTreasuryUpdated(newTreasury);
    }
}
