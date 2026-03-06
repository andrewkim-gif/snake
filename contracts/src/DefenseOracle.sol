// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "./libraries/DefenseLib.sol";
import "./interfaces/IDefenseOracle.sol";

/**
 * @title DefenseOracle
 * @notice Maps token market cap to in-game defense multiplier
 * @dev Updated by game server every 5 minutes via CROSS RPC
 *      Circuit breaker freezes buff on 30%+ sudden changes
 */
contract DefenseOracle is IDefenseOracle, Ownable {
    // ISO3 -> defense data
    mapping(string => DefenseData) private _defenseData;

    // Authorized updaters (game server addresses)
    mapping(address => bool) public updaters;

    // Freeze duration: 1 hour
    uint256 public constant FREEZE_DURATION = 1 hours;

    // --- Errors ---
    error NotAuthorized();
    error ArrayLengthMismatch();

    modifier onlyUpdater() {
        if (!updaters[msg.sender] && msg.sender != owner()) revert NotAuthorized();
        _;
    }

    constructor() Ownable(msg.sender) {
        updaters[msg.sender] = true;
    }

    // --- Public Views ---

    function getDefenseMultiplier(string calldata iso3) external view override returns (uint256) {
        DefenseData storage d = _defenseData[iso3];
        if (d.frozen && block.timestamp < d.lastUpdated + FREEZE_DURATION) {
            // During freeze, return base multiplier (1.0x)
            return DefenseLib.BP_BASE;
        }
        if (d.lastUpdated == 0) return DefenseLib.BP_BASE;
        return d.defenseMultiplier;
    }

    function getDefenseData(string calldata iso3) external view override returns (DefenseData memory) {
        return _defenseData[iso3];
    }

    // --- Updater Functions ---

    function updateMarketCap(string calldata iso3, uint256 newMarketCap) external override onlyUpdater {
        _updateSingle(iso3, newMarketCap);
    }

    function batchUpdateMarketCaps(
        string[] calldata iso3s,
        uint256[] calldata caps
    ) external override onlyUpdater {
        if (iso3s.length != caps.length) revert ArrayLengthMismatch();
        for (uint256 i; i < iso3s.length; ++i) {
            _updateSingle(iso3s[i], caps[i]);
        }
    }

    // --- Admin ---

    function setUpdater(address updater, bool authorized) external onlyOwner {
        updaters[updater] = authorized;
    }

    function manualUnfreeze(string calldata iso3) external onlyOwner {
        _defenseData[iso3].frozen = false;
        emit DefenseUnfrozen(iso3);
    }

    // --- Internal ---

    function _updateSingle(string calldata iso3, uint256 newMarketCap) internal {
        DefenseData storage d = _defenseData[iso3];
        uint256 oldCap = d.marketCap;

        // Check circuit breaker
        if (DefenseLib.shouldTripCircuitBreaker(oldCap, newMarketCap)) {
            d.frozen = true;
            d.lastUpdated = block.timestamp;
            emit DefenseFrozen(iso3, oldCap, newMarketCap);
            return;
        }

        // Auto-unfreeze after duration
        if (d.frozen && block.timestamp >= d.lastUpdated + FREEZE_DURATION) {
            d.frozen = false;
            emit DefenseUnfrozen(iso3);
        }

        uint256 newMultiplier = DefenseLib.calcMultiplier(newMarketCap);

        d.marketCap = newMarketCap;
        d.defenseMultiplier = newMultiplier;
        d.lastUpdated = block.timestamp;

        emit DefenseUpdated(iso3, newMarketCap, newMultiplier);
    }
}
