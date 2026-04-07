const express = require("express");
const path = require("path");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

const PORT = process.env.PORT || 3000;
app.use(express.static(path.join(__dirname, "public")));

let waitingPlayer = null;
const games = new Map();

function createEmptyBoard() {
    return ["", "", "", "", "", "", "", "", ""];
}

function checkWinner(board) {
    const winningCombinations = [
        [0, 1, 2],
        [3, 4, 5],
        [6, 7, 8],
        [0, 3, 6],
        [1, 4, 7],
        [2, 5, 8],
        [0, 4, 8],
        [2, 4, 6]
    ];

    for (const [a, b, c] of winningCombinations) {
        if (board[a] !== "" && board[a] === board[b] && board[a] === board[c]) {
            return board[a];
        }
    }

    return null;
}

io.on("connection", (socket) => {
    console.log("A player connected:", socket.id);

    socket.on("findMatch", () => {
        console.log("findMatch from:", socket.id);

        if (waitingPlayer && waitingPlayer !== socket.id) {
            const gameId = waitingPlayer + "-" + socket.id;

            const firstPlayer = io.sockets.sockets.get(waitingPlayer);
            const secondPlayer = socket;

            if (!firstPlayer) {
                waitingPlayer = socket.id;
                socket.emit("waitingForOpponent");
                return;
            }

            const game = {
                id: gameId,
                board: createEmptyBoard(),
                currentPlayer: "X",
                players: {
                    X: firstPlayer.id,
                    O: secondPlayer.id
                },
                gameOver: false,
                rematchVotes: {
                    X: false,
                    O: false
                }
            };

            games.set(gameId, game);

            firstPlayer.join(gameId);
            secondPlayer.join(gameId);

            io.to(firstPlayer.id).emit("matchFound", {
                gameId: gameId,
                symbol: "X",
                board: game.board,
                currentPlayer: game.currentPlayer
            });

            io.to(secondPlayer.id).emit("matchFound", {
                gameId: gameId,
                symbol: "O",
                board: game.board,
                currentPlayer: game.currentPlayer
            });

            console.log("Match created:", gameId);

            waitingPlayer = null;
        } else {
            waitingPlayer = socket.id;
            socket.emit("waitingForOpponent");
            console.log("Player waiting:", socket.id);
        }
    });

    socket.on("makeMove", ({ gameId, index }) => {
        const game = games.get(gameId);
        if (!game) return;
        if (game.gameOver) return;

        let playerSymbol = null;

        if (game.players.X === socket.id) {
            playerSymbol = "X";
        } else if (game.players.O === socket.id) {
            playerSymbol = "O";
        } else {
            return;
        }

        if (game.currentPlayer !== playerSymbol) return;
        if (game.board[index] !== "") return;

        game.board[index] = playerSymbol;

        const winner = checkWinner(game.board);

        if (winner) {
            game.gameOver = true;

            io.to(gameId).emit("gameUpdate", {
                board: game.board,
                currentPlayer: game.currentPlayer,
                winner: winner,
                draw: false
            });

            return;
        }

        const isDraw = game.board.every(cell => cell !== "");

        if (isDraw) {
            game.gameOver = true;

            io.to(gameId).emit("gameUpdate", {
                board: game.board,
                currentPlayer: game.currentPlayer,
                winner: null,
                draw: true
            });

            return;
        }

        game.currentPlayer = game.currentPlayer === "X" ? "O" : "X";

        io.to(gameId).emit("gameUpdate", {
            board: game.board,
            currentPlayer: game.currentPlayer,
            winner: null,
            draw: false
        });
    });

    socket.on("requestRematch", ({ gameId }) => {
        const game = games.get(gameId);
        if (!game) return;

        let playerSymbol = null;

        if (game.players.X === socket.id) {
            playerSymbol = "X";
        } else if (game.players.O === socket.id) {
            playerSymbol = "O";
        } else {
            return;
        }

        game.rematchVotes[playerSymbol] = true;

        if (game.rematchVotes.X && game.rematchVotes.O) {
            game.board = createEmptyBoard();
            game.currentPlayer = "X";
            game.gameOver = false;
            game.rematchVotes.X = false;
            game.rematchVotes.O = false;

            io.to(gameId).emit("rematchStarted", {
                board: game.board,
                currentPlayer: game.currentPlayer
            });
        } else {
            socket.to(gameId).emit("opponentWantsRematch");
            socket.emit("waitingForRematch");
        }
    });

    socket.on("disconnect", () => {
        console.log("A player disconnected:", socket.id);

        if (waitingPlayer === socket.id) {
            waitingPlayer = null;
        }

        for (const [gameId, game] of games.entries()) {
            if (game.players.X === socket.id || game.players.O === socket.id) {
                socket.to(gameId).emit("opponentLeft");
                games.delete(gameId);
            }
        }
    });
});

server.listen(PORT, () => {
    console.log("Server running on http://localhost:" + PORT);
});