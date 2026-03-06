// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/**
 * @title GovernanceModule
 * @notice Quadratic voting governance for national economic policies
 * @dev Token holders vote on proposals affecting their country's economy
 *      Vote power = sqrt(tokens_used), preventing whale domination
 */
contract GovernanceModule is Ownable {
    // --- Types ---
    enum ProposalStatus { Active, Passed, Rejected, Executed }

    struct Proposal {
        uint256 id;
        string iso3;
        address proposer;
        string title;
        string description;
        uint8 proposalType; // 0=tax, 1=trade, 2=defense, 3=treasury, 4=other
        uint256 forVotes;   // quadratic-weighted
        uint256 againstVotes;
        uint256 startTime;
        uint256 endTime;
        ProposalStatus status;
        bool executed;
    }

    // --- Storage ---
    mapping(uint256 => Proposal) public proposals;
    // proposalId -> voter -> hasVoted
    mapping(uint256 => mapping(address => bool)) public hasVoted;
    // proposalId -> voter -> tokens locked
    mapping(uint256 => mapping(address => uint256)) public voteLocked;
    uint256 public proposalCount;

    // ISO3 -> token address (set by admin)
    mapping(string => address) public countryTokens;

    // Config
    uint256 public votingDuration = 3 days;
    uint256 public minProposalTokens = 1000e18; // Min tokens to propose
    uint256 public quorumBasisPoints = 500; // 5% of circulating supply

    // --- Events ---
    event ProposalCreated(uint256 indexed id, string iso3, address proposer, string title);
    event Voted(uint256 indexed id, address voter, bool support, uint256 quadraticWeight);
    event ProposalExecuted(uint256 indexed id);
    event ProposalFinalized(uint256 indexed id, ProposalStatus status);
    event CountryTokenSet(string iso3, address token);

    // --- Errors ---
    error ProposalNotActive();
    error AlreadyVoted();
    error InsufficientTokens();
    error VotingNotEnded();
    error VotingEnded();
    error NotExecutable();
    error TokenNotRegistered();

    constructor() Ownable(msg.sender) {}

    // --- Proposal Lifecycle ---

    /**
     * @notice Create a new governance proposal for a country
     */
    function createProposal(
        string calldata iso3,
        string calldata title,
        string calldata description,
        uint8 proposalType
    ) external returns (uint256) {
        address token = countryTokens[iso3];
        if (token == address(0)) revert TokenNotRegistered();
        if (IERC20(token).balanceOf(msg.sender) < minProposalTokens) revert InsufficientTokens();

        uint256 id = proposalCount++;
        proposals[id] = Proposal({
            id: id,
            iso3: iso3,
            proposer: msg.sender,
            title: title,
            description: description,
            proposalType: proposalType,
            forVotes: 0,
            againstVotes: 0,
            startTime: block.timestamp,
            endTime: block.timestamp + votingDuration,
            status: ProposalStatus.Active,
            executed: false
        });

        emit ProposalCreated(id, iso3, msg.sender, title);
        return id;
    }

    /**
     * @notice Vote on a proposal using quadratic voting
     * @param proposalId The proposal to vote on
     * @param support True = for, False = against
     * @param tokenAmount Tokens to commit (quadratic: vote power = sqrt(amount))
     */
    function vote(uint256 proposalId, bool support, uint256 tokenAmount) external {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.Active) revert ProposalNotActive();
        if (block.timestamp >= p.endTime) revert VotingEnded();
        if (hasVoted[proposalId][msg.sender]) revert AlreadyVoted();
        if (tokenAmount == 0) revert InsufficientTokens();

        address token = countryTokens[p.iso3];
        if (IERC20(token).balanceOf(msg.sender) < tokenAmount) revert InsufficientTokens();

        // Lock tokens for voting duration
        IERC20(token).transferFrom(msg.sender, address(this), tokenAmount);
        voteLocked[proposalId][msg.sender] = tokenAmount;

        // Quadratic weight: sqrt(tokenAmount) scaled to 18 decimals
        uint256 quadWeight = _sqrt(tokenAmount);

        if (support) {
            p.forVotes += quadWeight;
        } else {
            p.againstVotes += quadWeight;
        }

        hasVoted[proposalId][msg.sender] = true;
        emit Voted(proposalId, msg.sender, support, quadWeight);
    }

    /**
     * @notice Finalize a proposal after voting period
     */
    function finalizeProposal(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.Active) revert ProposalNotActive();
        if (block.timestamp < p.endTime) revert VotingNotEnded();

        if (p.forVotes > p.againstVotes) {
            p.status = ProposalStatus.Passed;
        } else {
            p.status = ProposalStatus.Rejected;
        }

        emit ProposalFinalized(proposalId, p.status);
    }

    /**
     * @notice Withdraw locked tokens after voting ends
     */
    function withdrawVoteTokens(uint256 proposalId) external {
        Proposal storage p = proposals[proposalId];
        if (block.timestamp < p.endTime) revert VotingNotEnded();

        uint256 locked = voteLocked[proposalId][msg.sender];
        if (locked == 0) revert InsufficientTokens();

        voteLocked[proposalId][msg.sender] = 0;
        IERC20(countryTokens[p.iso3]).transfer(msg.sender, locked);
    }

    /**
     * @notice Mark a passed proposal as executed (by game server)
     */
    function executeProposal(uint256 proposalId) external onlyOwner {
        Proposal storage p = proposals[proposalId];
        if (p.status != ProposalStatus.Passed) revert NotExecutable();
        p.status = ProposalStatus.Executed;
        p.executed = true;
        emit ProposalExecuted(proposalId);
    }

    // --- Admin ---

    function setCountryToken(string calldata iso3, address token) external onlyOwner {
        countryTokens[iso3] = token;
        emit CountryTokenSet(iso3, token);
    }

    function batchSetCountryTokens(
        string[] calldata iso3s,
        address[] calldata tokens
    ) external onlyOwner {
        for (uint256 i; i < iso3s.length; ++i) {
            countryTokens[iso3s[i]] = tokens[i];
        }
    }

    function setVotingDuration(uint256 duration) external onlyOwner {
        votingDuration = duration;
    }

    function setMinProposalTokens(uint256 amount) external onlyOwner {
        minProposalTokens = amount;
    }

    // --- Internal ---

    /**
     * @notice Integer square root (Babylonian method) for quadratic voting
     */
    function _sqrt(uint256 x) internal pure returns (uint256) {
        if (x == 0) return 0;
        uint256 z = (x + 1) / 2;
        uint256 y = x;
        while (z < y) {
            y = z;
            z = (x / z + z) / 2;
        }
        return y;
    }
}
