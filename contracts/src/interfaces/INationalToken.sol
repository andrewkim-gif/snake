// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title INationalToken
 * @notice Interface for country-specific ERC-20 tokens deployed by NationalTokenFactory
 */
interface INationalToken is IERC20 {
    function iso3() external view returns (string memory);
    function tier() external view returns (uint8);
    function treasuryAddress() external view returns (address);
    function mint(address to, uint256 amount) external;
    function burn(uint256 amount) external;
    function burnFrom(address account, uint256 amount) external;
}
