// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Test.sol";
import "../src/core/PokerGame.sol";
import "../src/core/Escrow.sol";
import "../src/core/Tournament.sol";
import "../src/libraries/HandEvaluator.sol";

contract PokerGameTest is Test {
    PokerGame public pokerGame;
    Escrow public escrow;
    Tournament public tournament;

    address public player1 = address(0x1);
    address public player2 = address(0x2);

    uint256 public constant WAGER = 1 ether;

    function setUp() public {
        // Deploy contracts
        escrow = new Escrow();
        pokerGame = new PokerGame(address(escrow));
        tournament = new Tournament();

        // Configure
        escrow.setPokerGame(address(pokerGame));
        tournament.setPokerGame(address(pokerGame));

        // Fund players
        vm.deal(player1, 100 ether);
        vm.deal(player2, 100 ether);
    }

    function testCreateGame() public {
        bytes32 commitment = keccak256(abi.encodePacked(uint8(10), uint8(11), bytes32("salt1")));

        vm.prank(player1);
        bytes32 gameId = pokerGame.createGame{value: WAGER}(commitment);

        IPokerGame.Game memory game = pokerGame.getGame(gameId);

        assertEq(game.players[0].wallet, player1);
        assertEq(game.players[0].chips, WAGER);
        assertEq(uint8(game.phase), uint8(IPokerGame.GamePhase.WAITING));
        assertTrue(game.isActive);
    }

    function testJoinGame() public {
        bytes32 commitment1 = keccak256(abi.encodePacked(uint8(10), uint8(11), bytes32("salt1")));
        bytes32 commitment2 = keccak256(abi.encodePacked(uint8(20), uint8(21), bytes32("salt2")));

        vm.prank(player1);
        bytes32 gameId = pokerGame.createGame{value: WAGER}(commitment1);

        vm.prank(player2);
        pokerGame.joinGame{value: WAGER}(gameId, commitment2);

        IPokerGame.Game memory game = pokerGame.getGame(gameId);

        assertEq(game.players[1].wallet, player2);
        // After blinds are posted, chips are reduced
        // Small blind = 1% of wager, Big blind = 2% of wager
        // Total chips should be less than original wager
        assertTrue(game.players[0].chips < WAGER || game.players[1].chips < WAGER);
        assertEq(uint8(game.phase), uint8(IPokerGame.GamePhase.PREFLOP));
    }

    function testFold() public {
        (bytes32 gameId, ) = _setupGame();

        IPokerGame.Game memory game = pokerGame.getGame(gameId);
        address activePlayer = game.players[game.activePlayerIndex].wallet;

        uint256 winnerBalanceBefore;
        address expectedWinner;

        // The non-folding player wins
        if (game.activePlayerIndex == 0) {
            expectedWinner = player2;
        } else {
            expectedWinner = player1;
        }
        winnerBalanceBefore = expectedWinner.balance;

        vm.prank(activePlayer);
        pokerGame.takeAction(gameId, IPokerGame.Action.FOLD, 0);

        game = pokerGame.getGame(gameId);
        assertEq(uint8(game.phase), uint8(IPokerGame.GamePhase.COMPLETE));
        assertFalse(game.isActive);

        // Winner should receive the pot
        assertTrue(expectedWinner.balance > winnerBalanceBefore);
    }

    function testCannotActOutOfTurn() public {
        (bytes32 gameId, ) = _setupGame();

        IPokerGame.Game memory game = pokerGame.getGame(gameId);
        address inactivePlayer = game.players[1 - game.activePlayerIndex].wallet;

        vm.prank(inactivePlayer);
        vm.expectRevert(PokerGame.NotYourTurn.selector);
        pokerGame.takeAction(gameId, IPokerGame.Action.FOLD, 0);
    }

    function testEscrowBalance() public {
        bytes32 commitment1 = keccak256(abi.encodePacked(uint8(10), uint8(11), bytes32("salt1")));
        bytes32 commitment2 = keccak256(abi.encodePacked(uint8(20), uint8(21), bytes32("salt2")));

        vm.prank(player1);
        bytes32 gameId = pokerGame.createGame{value: WAGER}(commitment1);

        assertEq(escrow.getBalance(), WAGER);

        vm.prank(player2);
        pokerGame.joinGame{value: WAGER}(gameId, commitment2);

        assertEq(escrow.getBalance(), WAGER * 2);
    }

    // Helper functions

    function _setupGame() internal returns (bytes32 gameId, IPokerGame.Game memory game) {
        bytes32 commitment1 = keccak256(abi.encodePacked(uint8(10), uint8(11), bytes32("salt1")));
        bytes32 commitment2 = keccak256(abi.encodePacked(uint8(20), uint8(21), bytes32("salt2")));

        vm.prank(player1);
        gameId = pokerGame.createGame{value: WAGER}(commitment1);

        vm.prank(player2);
        pokerGame.joinGame{value: WAGER}(gameId, commitment2);

        game = pokerGame.getGame(gameId);
    }
}

contract HandEvaluatorTest is Test {
    using HandEvaluator for uint8[7];

    function testPair() public pure {
        // Pair of aces: A♠ A♥ 5♣ 8♦ 2♠ 3♥ 7♦
        uint8[7] memory hand = [
            uint8(48), // A♠ (rank 12, suit 0)
            uint8(49), // A♥ (rank 12, suit 1)
            uint8(12), // 5♣ (rank 3, suit 0)
            uint8(25), // 8♦ (rank 6, suit 1)
            uint8(0),  // 2♠ (rank 0, suit 0)
            uint8(5),  // 3♥ (rank 1, suit 1)
            uint8(22)  // 7♦ (rank 5, suit 2)
        ];

        HandEvaluator.HandResult memory result = hand.evaluate();
        assertEq(result.handRank, 2); // PAIR
    }

    function testFlush() public pure {
        // Flush in spades: A♠ K♠ Q♠ J♠ 9♠ 2♥ 3♥
        uint8[7] memory hand = [
            uint8(48), // A♠
            uint8(44), // K♠
            uint8(40), // Q♠
            uint8(36), // J♠
            uint8(28), // 9♠
            uint8(1),  // 2♥
            uint8(5)   // 3♥
        ];

        HandEvaluator.HandResult memory result = hand.evaluate();
        assertEq(result.handRank, 6); // FLUSH
    }

    function testStraight() public pure {
        // Straight: 5♠ 6♥ 7♦ 8♣ 9♠ 2♥ K♦
        uint8[7] memory hand = [
            uint8(12), // 5♠
            uint8(17), // 6♥
            uint8(22), // 7♦
            uint8(27), // 8♣
            uint8(28), // 9♠
            uint8(1),  // 2♥
            uint8(46)  // K♦
        ];

        HandEvaluator.HandResult memory result = hand.evaluate();
        assertEq(result.handRank, 5); // STRAIGHT
    }

    function testFullHouse() public pure {
        // Full house: A♠ A♥ A♦ K♠ K♥ 2♣ 3♣
        uint8[7] memory hand = [
            uint8(48), // A♠
            uint8(49), // A♥
            uint8(50), // A♦
            uint8(44), // K♠
            uint8(45), // K♥
            uint8(3),  // 2♣
            uint8(7)   // 3♣
        ];

        HandEvaluator.HandResult memory result = hand.evaluate();
        assertEq(result.handRank, 7); // FULL_HOUSE
    }

    function testCompareHands() public pure {
        // Hand 1: Pair of aces
        uint8[7] memory hand1 = [uint8(48), 49, 12, 25, 0, 5, 22];
        // Hand 2: Pair of kings
        uint8[7] memory hand2 = [uint8(44), 45, 12, 25, 0, 5, 22];

        HandEvaluator.HandResult memory result1 = hand1.evaluate();
        HandEvaluator.HandResult memory result2 = hand2.evaluate();

        int8 comparison = HandEvaluator.compare(result1, result2);
        assertEq(comparison, int8(1)); // Hand 1 wins (higher pair)
    }
}
