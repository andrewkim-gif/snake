// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/GovernanceModule.sol";
import "../src/NationalToken.sol";

contract GovernanceModuleTest is Test {
    GovernanceModule gov;
    NationalToken token;
    address voter1 = address(0xA);
    address voter2 = address(0xB);
    address treasury = address(0xBEEF);

    function setUp() public {
        gov = new GovernanceModule();
        token = new NationalToken("US Dollar", "USA", "USA", 0, 50_000_000e18, treasury);

        gov.setCountryToken("USA", address(token));

        // Fund voters
        vm.startPrank(treasury);
        token.transfer(voter1, 100_000e18);
        token.transfer(voter2, 50_000e18);
        vm.stopPrank();
    }

    function test_createProposal() public {
        vm.prank(voter1);
        uint256 id = gov.createProposal("USA", "Lower Tax", "Reduce tax to 3%", 0);
        assertEq(id, 0);

        (
            uint256 pid, , address proposer, string memory title,
            , , , , , ,
            GovernanceModule.ProposalStatus status,
        ) = gov.proposals(0);

        assertEq(pid, 0);
        assertEq(proposer, voter1);
        assertEq(title, "Lower Tax");
        assertTrue(status == GovernanceModule.ProposalStatus.Active);
    }

    function test_vote_quadratic() public {
        vm.prank(voter1);
        gov.createProposal("USA", "Lower Tax", "Reduce tax", 0);

        // voter1 votes with 10000 tokens -> sqrt(10000e18) quadratic weight
        vm.startPrank(voter1);
        token.approve(address(gov), 10_000e18);
        gov.vote(0, true, 10_000e18);
        vm.stopPrank();

        // voter2 votes against with 2500 tokens
        vm.startPrank(voter2);
        token.approve(address(gov), 2_500e18);
        gov.vote(0, false, 2_500e18);
        vm.stopPrank();

        (,,,,,, uint256 forV, uint256 againstV,,,,) = gov.proposals(0);
        // For should be higher since sqrt(10000e18) > sqrt(2500e18)
        assertTrue(forV > againstV);
    }

    function test_finalize_passed() public {
        vm.prank(voter1);
        gov.createProposal("USA", "Test", "Test", 0);

        vm.startPrank(voter1);
        token.approve(address(gov), 10_000e18);
        gov.vote(0, true, 10_000e18);
        vm.stopPrank();

        // Fast forward past voting duration
        vm.warp(block.timestamp + 3 days + 1);
        gov.finalizeProposal(0);

        (,,,,,,,,,,GovernanceModule.ProposalStatus status,) = gov.proposals(0);
        assertTrue(status == GovernanceModule.ProposalStatus.Passed);
    }

    function test_withdrawTokens() public {
        vm.prank(voter1);
        gov.createProposal("USA", "Test", "Test", 0);

        vm.startPrank(voter1);
        token.approve(address(gov), 5_000e18);
        gov.vote(0, true, 5_000e18);
        vm.stopPrank();

        uint256 balBefore = token.balanceOf(voter1);

        vm.warp(block.timestamp + 3 days + 1);
        vm.prank(voter1);
        gov.withdrawVoteTokens(0);

        assertEq(token.balanceOf(voter1), balBefore + 5_000e18);
    }

    function test_revert_doubleVote() public {
        vm.prank(voter1);
        gov.createProposal("USA", "Test", "Test", 0);

        vm.startPrank(voter1);
        token.approve(address(gov), 20_000e18);
        gov.vote(0, true, 10_000e18);

        vm.expectRevert(GovernanceModule.AlreadyVoted.selector);
        gov.vote(0, true, 10_000e18);
        vm.stopPrank();
    }
}
