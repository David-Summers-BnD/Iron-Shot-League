/**
 * Generate proper bracket seed order (prevents BYEs from facing each other)
 * For size 8: returns [1,8,4,5,2,7,3,6] - standard bracket seeding
 */
function generateBracketSeedOrder(bracketSize) {
  function generate(round) {
    if (round === 1) return [1, 2];
    const prev = generate(round - 1);
    const result = [];
    const numSeeds = Math.pow(2, round);
    for (let i = 0; i < prev.length; i++) {
      result.push(prev[i]);
      result.push(numSeeds + 1 - prev[i]);
    }
    return result;
  }

  const numRounds = Math.log2(bracketSize);
  return generate(numRounds);
}

/**
 * Generate single elimination bracket
 */
export function generateSingleElimination(players, seeded = false) {
  const n = players.length;

  // Find next power of 2
  let bracketSize = 1;
  while (bracketSize < n) {
    bracketSize *= 2;
  }

  // Seed players or use provided order
  let seededPlayers = [...players];
  if (!seeded) {
    // Shuffle for random seeding
    seededPlayers = shuffleArray(seededPlayers);
  }

  // Get proper bracket seed order (ensures BYEs go to top seeds, never BYE vs BYE)
  const seedOrder = generateBracketSeedOrder(bracketSize);

  // Create bracket array with proper seeding
  // seedOrder contains seed numbers (1-based), map to players or BYE
  const bracket = [];
  for (const seedNum of seedOrder) {
    if (seedNum <= seededPlayers.length) {
      bracket.push(seededPlayers[seedNum - 1]); // seedNum is 1-based
    } else {
      bracket.push(null); // BYE
    }
  }

  // Generate rounds
  const numRounds = Math.log2(bracketSize);
  const rounds = [];
  let matchId = 1;

  // First round
  const firstRound = [];
  for (let i = 0; i < bracketSize / 2; i++) {
    const player1 = bracket[i * 2];
    const player2 = bracket[i * 2 + 1];

    // Handle byes
    let winner = null;
    let completed = false;

    if (player1 === null) {
      winner = 'player2';
      completed = true;
    } else if (player2 === null) {
      winner = 'player1';
      completed = true;
    }

    firstRound.push({
      id: `match-${matchId++}`,
      round: 1,
      position: i,
      player1: player1 || 'BYE',
      player2: player2 || 'BYE',
      score1: null,
      score2: null,
      winner,
      completed,
      nextMatchId: null // Will be set below
    });
  }

  rounds.push({ number: 1, name: getRoundName(numRounds, 1), matches: firstRound });

  // Generate subsequent rounds
  let previousRoundMatches = firstRound;
  for (let roundNum = 2; roundNum <= numRounds; roundNum++) {
    const roundMatches = [];
    const matchesInRound = previousRoundMatches.length / 2;

    for (let i = 0; i < matchesInRound; i++) {
      roundMatches.push({
        id: `match-${matchId++}`,
        round: roundNum,
        position: i,
        player1: null, // TBD from previous round
        player2: null,
        score1: null,
        score2: null,
        winner: null,
        completed: false,
        sourceMatch1: previousRoundMatches[i * 2].id,
        sourceMatch2: previousRoundMatches[i * 2 + 1].id
      });

      // Link previous matches to this one
      previousRoundMatches[i * 2].nextMatchId = roundMatches[i].id;
      previousRoundMatches[i * 2 + 1].nextMatchId = roundMatches[i].id;
    }

    rounds.push({
      number: roundNum,
      name: getRoundName(numRounds, roundNum),
      matches: roundMatches
    });

    previousRoundMatches = roundMatches;
  }

  // Advance any bye winners
  advanceByeWinners(rounds);

  return {
    type: 'single_elimination',
    bracketSize,
    numRounds,
    rounds,
    players: seededPlayers
  };
}

/**
 * Generate double elimination bracket
 */
export function generateDoubleElimination(players, seeded = false) {
  const winners = generateSingleElimination(players, seeded);

  // Create losers bracket structure
  const losersRounds = [];
  let matchId = 1000; // Start losers matches at high number

  // Losers bracket has 2 * (numRounds - 1) rounds
  const numLosersRounds = (winners.numRounds - 1) * 2;

  for (let i = 1; i <= numLosersRounds; i++) {
    losersRounds.push({
      number: i,
      name: `Losers Round ${i}`,
      matches: []
    });
  }

  return {
    type: 'double_elimination',
    bracketSize: winners.bracketSize,
    numRounds: winners.numRounds,
    winners: winners.rounds,
    losers: losersRounds,
    grandFinal: {
      id: 'grand-final',
      player1: null, // Winners bracket champion
      player2: null, // Losers bracket champion
      score1: null,
      score2: null,
      winner: null,
      completed: false,
      needsReset: false
    },
    players: winners.players
  };
}

/**
 * Update match result and advance winner
 */
export function updateMatch(bracket, matchId, score1, score2, winner) {
  let matchFound = false;

  // Find and update the match
  for (const round of bracket.rounds || bracket.winners) {
    for (const match of round.matches) {
      if (match.id === matchId) {
        match.score1 = score1;
        match.score2 = score2;
        match.winner = winner;
        match.completed = true;
        matchFound = true;

        // Advance winner to next match
        if (match.nextMatchId) {
          const winnerName = winner === 'player1' ? match.player1 : match.player2;
          advanceToMatch(bracket, match.nextMatchId, winnerName, match.position);
        }

        break;
      }
    }
    if (matchFound) break;
  }

  return bracket;
}

/**
 * Advance a player to the next match
 */
function advanceToMatch(bracket, matchId, playerName, sourcePosition) {
  for (const round of bracket.rounds || bracket.winners) {
    for (const match of round.matches) {
      if (match.id === matchId) {
        // Determine if player goes to slot 1 or 2 based on source position
        if (sourcePosition % 2 === 0) {
          match.player1 = playerName;
        } else {
          match.player2 = playerName;
        }
        return;
      }
    }
  }
}

/**
 * Advance bye winners in first round
 */
function advanceByeWinners(rounds) {
  const firstRound = rounds[0].matches;

  for (const match of firstRound) {
    if (match.completed && match.nextMatchId) {
      const winnerName = match.winner === 'player1' ? match.player1 : match.player2;
      if (winnerName !== 'BYE') {
        for (const round of rounds) {
          for (const nextMatch of round.matches) {
            if (nextMatch.id === match.nextMatchId) {
              if (match.position % 2 === 0) {
                nextMatch.player1 = winnerName;
              } else {
                nextMatch.player2 = winnerName;
              }
            }
          }
        }
      }
    }
  }
}

/**
 * Get round name based on total rounds
 */
function getRoundName(totalRounds, currentRound) {
  const remaining = totalRounds - currentRound;

  if (remaining === 0) return 'Final';
  if (remaining === 1) return 'Semifinals';
  if (remaining === 2) return 'Quarterfinals';

  return `Round ${currentRound}`;
}

/**
 * Shuffle array (Fisher-Yates)
 */
function shuffleArray(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * Check if bracket is complete
 */
export function isBracketComplete(bracket) {
  const finalRound = bracket.rounds?.[bracket.rounds.length - 1] || bracket.winners?.[bracket.winners.length - 1];
  if (!finalRound) return false;

  const finalMatch = finalRound.matches[0];
  return finalMatch?.completed || false;
}

/**
 * Get bracket winner
 */
export function getBracketWinner(bracket) {
  const finalRound = bracket.rounds?.[bracket.rounds.length - 1] || bracket.winners?.[bracket.winners.length - 1];
  if (!finalRound) return null;

  const finalMatch = finalRound.matches[0];
  if (!finalMatch?.completed) return null;

  return finalMatch.winner === 'player1' ? finalMatch.player1 : finalMatch.player2;
}
