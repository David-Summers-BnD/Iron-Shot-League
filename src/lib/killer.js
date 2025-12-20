/**
 * Killer Pool Game Logic
 *
 * Rules:
 * - Each player starts with a set number of lives (default: 3)
 * - Turn order is randomized at game start
 * - Miss a pot: lose 1 life
 * - Commit a foul: lose 1 life
 * - Pot the black (8-ball): gain 1 life
 * - Player with 0 lives is eliminated
 * - Last player standing wins
 */

/**
 * Shuffle array using Fisher-Yates algorithm
 */
function shuffleArray(array) {
  const shuffled = [...array];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

/**
 * Create initial game state
 * @param {string[]} players - Array of player names
 * @param {number} startingLives - Number of lives each player starts with
 * @returns {object} Initial game state
 */
export function createKillerGame(players, startingLives = 3) {
  const shuffled = shuffleArray(players);
  return {
    players: shuffled.map(name => ({
      name,
      lives: startingLives,
      eliminated: false
    })),
    currentPlayerIndex: 0,
    gameOver: false,
    winner: null,
    turnHistory: []
  };
}

/**
 * Get the current player
 * @param {object} gameState - Current game state
 * @returns {object|null} Current player object or null if game over
 */
export function getCurrentPlayer(gameState) {
  if (gameState.gameOver) return null;
  return gameState.players[gameState.currentPlayerIndex];
}

/**
 * Find the next active (non-eliminated) player
 * @param {object} gameState - Current game state
 * @returns {number} Index of next active player
 */
function findNextActivePlayer(gameState) {
  const numPlayers = gameState.players.length;
  let nextIndex = (gameState.currentPlayerIndex + 1) % numPlayers;

  // Loop until we find a non-eliminated player
  let attempts = 0;
  while (gameState.players[nextIndex].eliminated && attempts < numPlayers) {
    nextIndex = (nextIndex + 1) % numPlayers;
    attempts++;
  }

  return nextIndex;
}

/**
 * Check if there's a winner (only one player remaining)
 * @param {object} gameState - Current game state
 * @returns {object|null} Winner player object or null
 */
export function checkWinner(gameState) {
  const activePlayers = gameState.players.filter(p => !p.eliminated);
  if (activePlayers.length === 1) {
    return activePlayers[0];
  }
  return null;
}

/**
 * Process a turn result
 * @param {object} gameState - Current game state
 * @param {'pot' | 'miss' | 'foul' | 'black'} result - Result of the turn
 * @returns {object} New game state
 */
export function processTurn(gameState, result) {
  // Clone the state to avoid mutations
  const newState = {
    ...gameState,
    players: gameState.players.map(p => ({ ...p })),
    turnHistory: [...gameState.turnHistory]
  };

  const currentPlayer = newState.players[newState.currentPlayerIndex];

  // Apply result
  switch (result) {
    case 'pot':
      // Successful pot - no change to lives, move to next player
      break;

    case 'miss':
    case 'foul':
      // Lose a life
      currentPlayer.lives = Math.max(0, currentPlayer.lives - 1);
      if (currentPlayer.lives === 0) {
        currentPlayer.eliminated = true;
      }
      break;

    case 'black':
      // Pot the black - gain a life
      currentPlayer.lives += 1;
      break;
  }

  // Record turn in history
  newState.turnHistory.push({
    player: currentPlayer.name,
    action: result,
    livesAfter: currentPlayer.lives,
    timestamp: new Date().toISOString()
  });

  // Check for winner
  const winner = checkWinner(newState);
  if (winner) {
    newState.gameOver = true;
    newState.winner = winner.name;
  } else {
    // Move to next player
    newState.currentPlayerIndex = findNextActivePlayer(newState);
  }

  return newState;
}

/**
 * Get game statistics
 * @param {object} gameState - Current game state
 * @returns {object} Game statistics
 */
export function getGameStats(gameState) {
  const activePlayers = gameState.players.filter(p => !p.eliminated);
  const eliminatedPlayers = gameState.players.filter(p => p.eliminated);
  const totalLives = gameState.players.reduce((sum, p) => sum + p.lives, 0);

  return {
    activePlayers: activePlayers.length,
    eliminatedPlayers: eliminatedPlayers.length,
    totalLives,
    turnsPlayed: gameState.turnHistory.length
  };
}

/**
 * Get elimination order (for final standings)
 * @param {object} gameState - Current game state
 * @returns {string[]} Players in elimination order (first eliminated = last place)
 */
export function getEliminationOrder(gameState) {
  const eliminated = [];

  // Go through turn history to find elimination order
  for (const turn of gameState.turnHistory) {
    const player = gameState.players.find(p => p.name === turn.player);
    if (turn.livesAfter === 0 && !eliminated.includes(turn.player)) {
      eliminated.push(turn.player);
    }
  }

  return eliminated;
}
