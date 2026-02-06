// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "forge-std/Script.sol";
import "../src/core/Escrow4Max.sol";
import "../src/core/PokerGame4Max.sol";

contract Deploy4MaxScript is Script {
    function run() external {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);

        // Deploy Escrow4Max
        Escrow4Max escrow4Max = new Escrow4Max();
        console.log("Escrow4Max deployed at:", address(escrow4Max));

        // Deploy PokerGame4Max
        PokerGame4Max pokerGame4Max = new PokerGame4Max(address(escrow4Max));
        console.log("PokerGame4Max deployed at:", address(pokerGame4Max));

        // Configure contracts
        escrow4Max.setPokerGame(address(pokerGame4Max));

        console.log("\n4-Max Deployment complete!");
        console.log("-------------------");
        console.log("ESCROW_4MAX_ADDRESS=", address(escrow4Max));
        console.log("POKER_GAME_4MAX_ADDRESS=", address(pokerGame4Max));

        vm.stopBroadcast();
    }
}
