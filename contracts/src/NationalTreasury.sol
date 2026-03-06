// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC20/utils/SafeERC20.sol";
import "./NationalToken.sol";

/**
 * @title NationalTreasury
 * @notice Per-country treasury managing buyback, burn, and staking
 * @dev One treasury per country token. Controlled by game server (owner).
 */
contract NationalTreasury is Ownable {
    using SafeERC20 for IERC20;

    // --- State ---
    NationalToken public nationalToken;
    string public iso3;

    // Staking
    mapping(address => uint256) public stakedBalance;
    mapping(address => uint256) public stakeTimestamp;
    uint256 public totalStaked;
    uint256 public stakingAPR; // basis points (e.g. 1000 = 10%)

    // Buyback/Burn stats
    uint256 public totalBuybackAmount;
    uint256 public totalBurnedAmount;
    uint256 public buybackCount;
    uint256 public burnCount;

    // --- Events ---
    event Staked(address indexed user, uint256 amount);
    event Unstaked(address indexed user, uint256 amount, uint256 reward);
    event BuybackExecuted(uint256 ethSpent, uint256 tokensReceived);
    event TokensBurned(uint256 amount, string reason);
    event StakingAPRUpdated(uint256 newAPR);

    // --- Errors ---
    error InsufficientStake();
    error ZeroAmount();
    error TransferFailed();

    constructor(
        address _nationalToken,
        string memory _iso3,
        uint256 _initialAPR
    ) Ownable(msg.sender) {
        nationalToken = NationalToken(_nationalToken);
        iso3 = _iso3;
        stakingAPR = _initialAPR;
    }

    // --- Staking ---

    /**
     * @notice Stake national tokens for defense contribution
     */
    function stake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();

        // Claim pending rewards first
        if (stakedBalance[msg.sender] > 0) {
            _claimRewards(msg.sender);
        }

        IERC20(address(nationalToken)).safeTransferFrom(msg.sender, address(this), amount);

        stakedBalance[msg.sender] += amount;
        stakeTimestamp[msg.sender] = block.timestamp;
        totalStaked += amount;

        emit Staked(msg.sender, amount);
    }

    /**
     * @notice Unstake tokens and claim rewards
     */
    function unstake(uint256 amount) external {
        if (amount == 0) revert ZeroAmount();
        if (stakedBalance[msg.sender] < amount) revert InsufficientStake();

        uint256 reward = _calculateReward(msg.sender);

        stakedBalance[msg.sender] -= amount;
        totalStaked -= amount;
        stakeTimestamp[msg.sender] = block.timestamp;

        IERC20(address(nationalToken)).safeTransfer(msg.sender, amount);

        // Mint rewards
        if (reward > 0) {
            nationalToken.mint(msg.sender, reward);
        }

        emit Unstaked(msg.sender, amount, reward);
    }

    /**
     * @notice View pending staking rewards
     */
    function pendingReward(address user) external view returns (uint256) {
        return _calculateReward(user);
    }

    // --- Buyback (called by game server) ---

    /**
     * @notice Record a buyback event (tokens purchased from DEX)
     * @dev Called by game server after executing on-chain DEX buyback
     */
    function recordBuyback(uint256 ethSpent, uint256 tokensReceived) external onlyOwner {
        totalBuybackAmount += tokensReceived;
        buybackCount++;
        emit BuybackExecuted(ethSpent, tokensReceived);
    }

    /**
     * @notice Burn tokens from treasury (war victory / deflation)
     */
    function burnTokens(uint256 amount, string calldata reason) external onlyOwner {
        if (amount == 0) revert ZeroAmount();
        nationalToken.burn(amount);
        totalBurnedAmount += amount;
        burnCount++;
        emit TokensBurned(amount, reason);
    }

    /**
     * @notice Update staking APR
     */
    function setStakingAPR(uint256 newAPR) external onlyOwner {
        stakingAPR = newAPR;
        emit StakingAPRUpdated(newAPR);
    }

    /**
     * @notice Get treasury stats
     */
    function getStats() external view returns (
        uint256 _totalStaked,
        uint256 _totalBuyback,
        uint256 _totalBurned,
        uint256 _buybackCount,
        uint256 _burnCount,
        uint256 _apr
    ) {
        return (totalStaked, totalBuybackAmount, totalBurnedAmount, buybackCount, burnCount, stakingAPR);
    }

    // --- Internal ---

    function _calculateReward(address user) internal view returns (uint256) {
        uint256 staked = stakedBalance[user];
        if (staked == 0) return 0;

        uint256 elapsed = block.timestamp - stakeTimestamp[user];
        // reward = staked * APR * elapsed / (365 days * 10000 bp)
        return (staked * stakingAPR * elapsed) / (365 days * 10_000);
    }

    function _claimRewards(address user) internal {
        uint256 reward = _calculateReward(user);
        if (reward > 0) {
            nationalToken.mint(user, reward);
        }
        stakeTimestamp[user] = block.timestamp;
    }

    /**
     * @notice Withdraw accidentally sent ERC20 tokens (not the national token)
     */
    function rescueERC20(address token, uint256 amount) external onlyOwner {
        if (token == address(nationalToken)) revert TransferFailed();
        IERC20(token).safeTransfer(owner(), amount);
    }

    receive() external payable {}
}
