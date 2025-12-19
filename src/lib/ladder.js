/**
 * Create initial ladder from players
 */
export function createLadder(players, randomize = true) {
  let orderedPlayers = [...players];

  if (randomize) {
    orderedPlayers = shuffleArray(orderedPlayers);
  }

  return orderedPlayers.map((player, index) => ({
    rank: index + 1,
    player,
    wins: 0,
    losses: 0,
    challenges: 0,
    defenses: 0,
    lastActive: null
  }));
}

/**
 * Process a challenge result
 */
export function processChallenge(ladder, challengerRank, defenderRank, challengerWins) {
  const newLadder = [...ladder];

  const challengerIdx = newLadder.findIndex(p => p.rank === challengerRank);
  const defenderIdx = newLadder.findIndex(p => p.rank === defenderRank);

  if (challengerIdx === -1 || defenderIdx === -1) return ladder;

  const now = new Date().toISOString();

  if (challengerWins) {
    // Challenger wins - swap positions
    newLadder[challengerIdx].wins++;
    newLadder[challengerIdx].challenges++;
    newLadder[challengerIdx].lastActive = now;

    newLadder[defenderIdx].losses++;
    newLadder[defenderIdx].defenses++;
    newLadder[defenderIdx].lastActive = now;

    // Swap ranks
    const challengerNewRank = defenderRank;
    const defenderNewRank = challengerRank;

    newLadder[challengerIdx].rank = challengerNewRank;
    newLadder[defenderIdx].rank = defenderNewRank;
  } else {
    // Defender wins - no swap
    newLadder[defenderIdx].wins++;
    newLadder[defenderIdx].defenses++;
    newLadder[defenderIdx].lastActive = now;

    newLadder[challengerIdx].losses++;
    newLadder[challengerIdx].challenges++;
    newLadder[challengerIdx].lastActive = now;
  }

  // Sort by rank
  return newLadder.sort((a, b) => a.rank - b.rank);
}

/**
 * Check if a challenge is valid
 */
export function isValidChallenge(ladder, challengerRank, defenderRank, maxRungs = 3) {
  // Can only challenge upward (lower rank number)
  if (defenderRank >= challengerRank) return false;

  // Must be within maxRungs
  if (challengerRank - defenderRank > maxRungs) return false;

  return true;
}

/**
 * Get available challenge targets for a player
 */
export function getAvailableTargets(ladder, challengerRank, maxRungs = 3) {
  return ladder.filter(p =>
    p.rank < challengerRank &&
    challengerRank - p.rank <= maxRungs
  );
}

/**
 * Shuffle array
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
