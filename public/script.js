const socket = io();
console.log("Socket connected:", socket.id);
console.log("JS connected");

const cells = document.querySelectorAll(".cell");
const statusText = document.querySelector(".status");
const restartButton = document.querySelector(".restart");
const findMatchButton = document.querySelector(".find-match-button");
const mainMenuButton = document.querySelector(".main-menu-button");
const inGameMenuButton = document.querySelector(".in-game-menu-button");
const startButtons = document.querySelectorAll(".start-button");
const settingsButton = document.querySelector(".settings-button");
const startScreen = document.querySelector(".start-screen");
const gameScreen = document.querySelector(".game-screen");
const gameOverScreen = document.querySelector(".game-over-screen");
const resultText = document.querySelector(".result-text");
let gameMode = "pvp";

let board = ["", "", "", "", "", "", "", "", ""];
let moveCount = 0;
let gameOver = false;

let onlineGameId = null;
let mySymbol = null;

socket.on("waitingForOpponent", function () {
    statusText.textContent = "Waiting for opponent...";
});

socket.on("matchFound", function (data) {
    onlineGameId = data.gameId;
    mySymbol = data.symbol;
    board = data.board;
    moveCount = 0;
    gameOver = false;

    cells.forEach(function (cell, index) {
        cell.textContent = board[index];
    });

    if (mySymbol === "X") {
        statusText.textContent = "Match found! You are X. Your turn.";
    } else {
        statusText.textContent = "Match found! You are O. Opponent starts.";
    }
});

socket.on("gameUpdate", function (data) {
    board = data.board;
    moveCount = board.filter(cell => cell !== "").length;

    cells.forEach(function (cell, index) {
        cell.textContent = board[index];
    });

    if (data.winner) {
        finishGame(data.winner);
        return;
    }

    if (data.draw) {
        finishGame(null);
        return;
    }

    if (data.currentPlayer === mySymbol) {
        statusText.textContent = "Your turn (" + mySymbol + ")";
    } else {
        statusText.textContent = "Opponent's turn";
    }
});

socket.on("opponentLeft", function () {
    alert("Your opponent left the game.");

    resetGame();
    onlineGameId = null;
    mySymbol = null;

    gameOverScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
});

socket.on("waitingForRematch", function () {
    resultText.textContent = "Waiting for opponent to accept rematch...";
});

socket.on("opponentWantsRematch", function () {
    resultText.textContent = "Opponent wants a rematch. Press Play Again to accept.";
});

socket.on("rematchStarted", function (data) {
    board = data.board;
    moveCount = 0;
    gameOver = false;

    cells.forEach(function (cell, index) {
        cell.textContent = board[index];
    });

    gameOverScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");

    if (findMatchButton) {
        findMatchButton.classList.add("hidden");
    }

    if (mySymbol === "X") {
        statusText.textContent = "Rematch started! You are X. Your turn.";
    } else {
        statusText.textContent = "Rematch started! You are O. Opponent starts.";
    }
});

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

    for (let i = 0; i < winningCombinations.length; i++) {
        const [a, b, c] = winningCombinations[i];

        if (
            board[a] !== "" &&
            board[a] === board[b] &&
            board[a] === board[c]
        ) {
            return board[a];
        }
    }

    return null;
}

function finishGame(winner) {
    gameOver = true;
    gameScreen.classList.add("hidden");
    gameOverScreen.classList.remove("hidden");

    if (gameMode === "online") {
        restartButton.classList.remove("hidden");
        if (findMatchButton) {
            findMatchButton.classList.remove("hidden");
        }
    } else {
        restartButton.classList.remove("hidden");
        if (findMatchButton) {
            findMatchButton.classList.add("hidden");
        }
    }

    if (winner === null) {
        resultText.textContent = "It's a draw!";
        return;
    }

    if (gameMode === "ai") {
        if (winner === "X") {
            resultText.textContent = "You win!";
        } else {
            resultText.textContent = "AI wins!";
        }
    } else {
        resultText.textContent = "Player " + winner + " wins!";
    }
}

function makeAiMove() {
    let emptyIndexes = [];

    for (let i = 0; i < board.length; i++) {
        if (board[i] === "") {
            emptyIndexes.push(i);
        }
    }

    if (emptyIndexes.length === 0) {
        return;
    }

    const randomPosition = Math.floor(Math.random() * emptyIndexes.length);
    const aiIndex = emptyIndexes[randomPosition];

    board[aiIndex] = "O";
    cells[aiIndex].textContent = "O";
    moveCount++;

    const winner = checkWinner(board);

    if (winner) {
        finishGame(winner);
        return;
    }

    if (moveCount === 9) {
        finishGame(null);
        return;
    }

    statusText.textContent = "Current player: X";
}

function resetGame() {
    board = ["", "", "", "", "", "", "", "", ""];
    moveCount = 0;
    gameOver = false;

    cells.forEach(function (cell) {
        cell.textContent = "";
    });

    restartButton.classList.remove("hidden");
    if (findMatchButton) {
        findMatchButton.classList.add("hidden");
    }

    statusText.textContent = "Current player: X";
}

startButtons.forEach(function (button) {
    button.addEventListener("click", function () {
        gameMode = button.dataset.mode;

        if (gameMode === "online") {
            resetGame();
            startScreen.classList.add("hidden");
            gameScreen.classList.remove("hidden");
            gameOverScreen.classList.add("hidden");

            statusText.textContent = "Searching for opponent...";
            socket.emit("findMatch");
            return;
        }

        resetGame();
        startScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");
        gameOverScreen.classList.add("hidden");
    });
});

settingsButton.addEventListener("click", function () {
    alert("Settings are not available yet.");
});

cells.forEach(function (cell) {
    cell.addEventListener("click", function () {
        if (gameOver) return;

        if (gameMode === "online") {
            const index = Number(cell.dataset.index);

            if (!onlineGameId) return;
            if (board[index] !== "") return;

            socket.emit("makeMove", {
                gameId: onlineGameId,
                index: index
            });

            return;
        }

        const index = cell.dataset.index;

        if (board[index] !== "") return;

        let symbol;
        if (moveCount % 2 === 0) {
            symbol = "X";
        } else {
            symbol = "O";
        }

        board[index] = symbol;
        cell.textContent = symbol;
        moveCount++;

        const winner = checkWinner(board);

        if (winner) {
            finishGame(winner);
            return;
        }

        if (moveCount === 9) {
            finishGame(null);
            return;
        }

        if (gameMode === "ai") {
            statusText.textContent = "AI is thinking...";
            setTimeout(function () {
                if (!gameOver) {
                    makeAiMove();
                }
            }, 300);
            return;
        }

        if (moveCount % 2 === 0) {
            statusText.textContent = "Current player: X";
        } else {
            statusText.textContent = "Current player: O";
        }
    });
});

restartButton.addEventListener("click", function () {
    if (gameMode === "online") {
        if (!onlineGameId) {
            return;
        }

        resultText.textContent = "Sending rematch request...";
        socket.emit("requestRematch", { gameId: onlineGameId });
        return;
    }

    resetGame();
    gameOverScreen.classList.add("hidden");
    gameScreen.classList.remove("hidden");
    if (gameMode === "ai") {
        statusText.textContent = "Current player: X";
    }
});

if (findMatchButton) {
    findMatchButton.addEventListener("click", function () {
        resetGame();
        onlineGameId = null;
        mySymbol = null;
        gameOverScreen.classList.add("hidden");
        gameScreen.classList.remove("hidden");
        statusText.textContent = "Searching for opponent...";
        socket.emit("findMatch");
    });
}

mainMenuButton.addEventListener("click", function () {
    resetGame();
    gameOverScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
});

inGameMenuButton.addEventListener("click", function () {
    resetGame();
    gameOverScreen.classList.add("hidden");
    gameScreen.classList.add("hidden");
    startScreen.classList.remove("hidden");
});