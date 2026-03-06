// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/NationalTokenFactory.sol";
import "../src/NationalToken.sol";

contract NationalTokenFactoryTest is Test {
    NationalTokenFactory factory;
    address treasury = address(0xBEEF);
    address deployer;

    function setUp() public {
        deployer = address(this);
        factory = new NationalTokenFactory(treasury);
    }

    function test_deployToken_S_tier() public {
        address token = factory.deployToken("United States Dollar", "USA", "USA", 0, address(0));
        assertEq(factory.tokensByISO3("USA"), token);
        assertEq(factory.totalTokens(), 1);

        NationalToken nt = NationalToken(token);
        assertEq(nt.iso3(), "USA");
        assertEq(nt.tier(), 0);
        assertEq(nt.totalSupply(), 50_000_000e18);
        assertEq(nt.balanceOf(treasury), 50_000_000e18);
    }

    function test_deployToken_D_tier() public {
        factory.deployToken("Fiji Dollar", "FJI", "FJI", 4, address(0));
        NationalToken nt = NationalToken(factory.tokensByISO3("FJI"));
        assertEq(nt.totalSupply(), 5_000_000e18);
    }

    function test_deployToken_customTreasury() public {
        address custom = address(0xCAFE);
        factory.deployToken("Japan Yen", "JPN", "JPN", 1, custom);
        NationalToken nt = NationalToken(factory.tokensByISO3("JPN"));
        assertEq(nt.balanceOf(custom), 30_000_000e18);
    }

    function test_revert_duplicateISO3() public {
        factory.deployToken("Token A", "USA", "USA", 0, address(0));
        vm.expectRevert(abi.encodeWithSelector(NationalTokenFactory.TokenAlreadyExists.selector, "USA"));
        factory.deployToken("Token B", "USA", "USA", 0, address(0));
    }

    function test_revert_invalidTier() public {
        vm.expectRevert(abi.encodeWithSelector(NationalTokenFactory.InvalidTier.selector, 5));
        factory.deployToken("Bad", "BAD", "BAD", 5, address(0));
    }

    function test_batchDeploy() public {
        string[] memory names = new string[](3);
        string[] memory symbols = new string[](3);
        string[] memory iso3s = new string[](3);
        uint8[] memory tiers = new uint8[](3);
        address[] memory treasuries = new address[](3);

        names[0] = "US Dollar"; symbols[0] = "USA"; iso3s[0] = "USA"; tiers[0] = 0;
        names[1] = "China Yuan"; symbols[1] = "CHN"; iso3s[1] = "CHN"; tiers[1] = 0;
        names[2] = "India Rupee"; symbols[2] = "IND"; iso3s[2] = "IND"; tiers[2] = 1;
        treasuries[0] = address(0);
        treasuries[1] = address(0);
        treasuries[2] = address(0);

        factory.batchDeployTokens(names, symbols, iso3s, tiers, treasuries);
        assertEq(factory.totalTokens(), 3);
        assertTrue(factory.tokensByISO3("USA") != address(0));
        assertTrue(factory.tokensByISO3("CHN") != address(0));
        assertTrue(factory.tokensByISO3("IND") != address(0));
    }

    function test_onlyOwner() public {
        vm.prank(address(0xDEAD));
        vm.expectRevert();
        factory.deployToken("Hack", "HCK", "HCK", 0, address(0));
    }
}
