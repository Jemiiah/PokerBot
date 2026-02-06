// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/Escrow.sol";
import "../src/core/PokerGame.sol";
import "../src/core/Tournament.sol";
import "../src/core/SpectatorBetting.sol";
import "../src/randomness/CommitReveal.sol";

contract DeployScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Escrow
        Escrow escrow = new Escrow();
        console.log("Escrow deployed at:", address(escrow));

        // Deploy PokerGame
        PokerGame pokerGame = new PokerGame(address(escrow));
        console.log("PokerGame deployed at:", address(pokerGame));

        // Deploy Tournament
        Tournament tournament = new Tournament();
        console.log("Tournament deployed at:", address(tournament));

        // Deploy CommitReveal
        CommitReveal commitReveal = new CommitReveal();
        console.log("CommitReveal deployed at:", address(commitReveal));

        // Deploy SpectatorBetting
        SpectatorBetting spectatorBetting = new SpectatorBetting(address(pokerGame));
        console.log("SpectatorBetting deployed at:", address(spectatorBetting));

        // Configure contracts
        escrow.setPokerGame(address(pokerGame));
        tournament.setPokerGame(address(pokerGame));

        console.log("\nDeployment complete!");
        console.log("-------------------");
        console.log("ESCROW_ADDRESS=", address(escrow));
        console.log("POKER_GAME_ADDRESS=", address(pokerGame));
        console.log("TOURNAMENT_ADDRESS=", address(tournament));
        console.log("COMMIT_REVEAL_ADDRESS=", address(commitReveal));
        console.log("SPECTATOR_BETTING_ADDRESS=", address(spectatorBetting));

        vm.stopBroadcast();
    }
}
