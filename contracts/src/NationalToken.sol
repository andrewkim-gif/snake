// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/token/ERC20/extensions/ERC20Burnable.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

/**
 * @title NationalToken
 * @notice ERC-20 token representing a nation's currency in AI World War
 * @dev Deployed per-country by NationalTokenFactory. Owner = factory/treasury.
 */
contract NationalToken is ERC20, ERC20Burnable, Ownable {
    string public iso3;
    uint8 public tier;
    address public treasuryAddress;

    error OnlyTreasury();
    error ZeroAddress();

    modifier onlyTreasury() {
        if (msg.sender != treasuryAddress && msg.sender != owner()) revert OnlyTreasury();
        _;
    }

    constructor(
        string memory _name,
        string memory _symbol,
        string memory _iso3,
        uint8 _tier,
        uint256 _initialSupply,
        address _treasury
    ) ERC20(_name, _symbol) Ownable(msg.sender) {
        if (_treasury == address(0)) revert ZeroAddress();
        iso3 = _iso3;
        tier = _tier;
        treasuryAddress = _treasury;
        _mint(_treasury, _initialSupply);
    }

    /**
     * @notice Mint new tokens (only treasury/owner)
     */
    function mint(address to, uint256 amount) external onlyTreasury {
        _mint(to, amount);
    }

    /**
     * @notice Update treasury address
     */
    function setTreasury(address newTreasury) external onlyOwner {
        if (newTreasury == address(0)) revert ZeroAddress();
        treasuryAddress = newTreasury;
    }
}
