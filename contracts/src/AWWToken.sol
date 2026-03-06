// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Permit.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title AWWToken
 * @notice $AWW — AI World War master governance token
 * @dev Total supply: 1,000,000,000 (1B)
 *
 * Distribution (minted at deploy):
 *   40% Ecosystem rewards  (400M)
 *   25% Community           (250M)
 *   15% Team (vested)       (150M)
 *   10% DEX liquidity       (100M)
 *   10% Treasury reserve    (100M)
 */
contract AWWToken is ERC20, ERC20Burnable, ERC20Permit, Ownable {
    uint256 public constant TOTAL_SUPPLY = 1_000_000_000e18; // 1B tokens

    // Distribution addresses
    address public ecosystemWallet;
    address public communityWallet;
    address public teamWallet;
    address public liquidityWallet;
    address public treasuryWallet;

    // Vesting
    uint256 public teamVestingStart;
    uint256 public constant TEAM_VESTING_DURATION = 730 days; // 2 years
    uint256 public teamClaimed;
    uint256 public constant TEAM_ALLOCATION = 150_000_000e18;

    error ZeroAddress();
    error VestingNotStarted();
    error NothingToClaim();

    constructor(
        address _ecosystem,
        address _community,
        address _team,
        address _liquidity,
        address _treasury
    ) ERC20("AI World War", "AWW") ERC20Permit("AI World War") Ownable(msg.sender) {
        if (_ecosystem == address(0) || _community == address(0) ||
            _team == address(0) || _liquidity == address(0) ||
            _treasury == address(0)) revert ZeroAddress();

        ecosystemWallet = _ecosystem;
        communityWallet = _community;
        teamWallet = _team;
        liquidityWallet = _liquidity;
        treasuryWallet = _treasury;
        teamVestingStart = block.timestamp;

        // Mint non-vested allocations immediately
        _mint(_ecosystem, 400_000_000e18);  // 40%
        _mint(_community, 250_000_000e18);  // 25%
        _mint(_liquidity, 100_000_000e18);  // 10%
        _mint(_treasury, 100_000_000e18);   // 10%
        // Team 15% is vested — minted on claim
    }

    /**
     * @notice Claim vested team tokens (linear vesting over 2 years)
     */
    function claimTeamTokens() external {
        if (msg.sender != teamWallet) revert ZeroAddress();

        uint256 elapsed = block.timestamp - teamVestingStart;
        if (elapsed == 0) revert VestingNotStarted();

        uint256 totalVested;
        if (elapsed >= TEAM_VESTING_DURATION) {
            totalVested = TEAM_ALLOCATION;
        } else {
            totalVested = (TEAM_ALLOCATION * elapsed) / TEAM_VESTING_DURATION;
        }

        uint256 claimable = totalVested - teamClaimed;
        if (claimable == 0) revert NothingToClaim();

        teamClaimed += claimable;
        _mint(teamWallet, claimable);
    }

    /**
     * @notice View claimable team tokens
     */
    function claimableTeamTokens() external view returns (uint256) {
        uint256 elapsed = block.timestamp - teamVestingStart;
        uint256 totalVested;
        if (elapsed >= TEAM_VESTING_DURATION) {
            totalVested = TEAM_ALLOCATION;
        } else {
            totalVested = (TEAM_ALLOCATION * elapsed) / TEAM_VESTING_DURATION;
        }
        return totalVested - teamClaimed;
    }
}
