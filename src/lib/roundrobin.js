/**
 * Generate round robin schedule using the circle method
 * Each player plays every other player exactly once
 */
export function generateRoundRobinSchedule(players) {
  if (players.length < 2) {
    return { rounds: [], matches: [] };
  }

  const n = players.length;
  const isOdd = n % 2 === 1;

  // If odd number of players, add a "BYE" placeholder
  const participants = isOdd ? [...players, null] : [...players];
  const numRounds = participants.length - 1;
  const halfSize = participants.length / 2;

  const rounds = [];
  const allMatches = [];

  // Create a copy to rotate (exclude first player)
  const rotating = participants.slice(1);

  for (let round = 0; round < numRounds; round++) {
    const roundMatches = [];

    // First player against first in rotating list
    const firstMatch = {
      id: crypto.randomUUID(),
      round: round + 1,
      player1: participants[0],
      player2: rotating[0],
      score1: null,
      score2: null,
      winner: null,
      completed: false
    };

    // Only add if neither player is null (bye)
    if (firstMatch.player1 !== null && firstMatch.player2 !== null) {
      roundMatches.push(firstMatch);
      allMatches.push(firstMatch);
    }

    // Pair remaining players (fold the array)
    for (let i = 1; i < halfSize; i++) {
      const player1 = rotating[i];
      const player2 = rotating[rotating.length - i];

      if (player1 !== null && player2 !== null) {
        const match = {
          id: crypto.randomUUID(),
          round: round + 1,
          player1,
          player2,
          score1: null,
          score2: null,
          winner: null,
          completed: false
        };
        roundMatches.push(match);
        allMatches.push(match);
      }
    }

    rounds.push({
      number: round + 1,
      matches: roundMatches
    });

    // Rotate: move last element to front
    rotating.unshift(rotating.pop());
  }

  return { rounds, matches: allMatches };
}

/**
 * Calculate standings from round robin results
 */
export function calculateStandings(players, matches) {
  const stats = {};

  // Initialize stats for all players
  players.forEach(player => {
    stats[player] = {
      player,
      played: 0,
      wins: 0,
      losses: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0
    };
  });

  // Process completed matches
  matches.forEach(match => {
    if (!match.completed) return;

    const { player1, player2, score1, score2, winner } = match;

    if (stats[player1]) {
      stats[player1].played++;
      stats[player1].pointsFor += score1 || 0;
      stats[player1].pointsAgainst += score2 || 0;
      if (winner === 'player1') stats[player1].wins++;
      else if (winner === 'player2') stats[player1].losses++;
    }

    if (stats[player2]) {
      stats[player2].played++;
      stats[player2].pointsFor += score2 || 0;
      stats[player2].pointsAgainst += score1 || 0;
      if (winner === 'player2') stats[player2].wins++;
      else if (winner === 'player1') stats[player2].losses++;
    }
  });

  // Calculate point differential and sort
  const standings = Object.values(stats).map(s => ({
    ...s,
    pointDiff: s.pointsFor - s.pointsAgainst
  }));

  // Sort by: wins (desc), point diff (desc), points for (desc)
  standings.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    return b.pointsFor - a.pointsFor;
  });

  return standings;
}

/**
 * Check if all matches are completed
 */
export function isRoundRobinComplete(matches) {
  return matches.length > 0 && matches.every(m => m.completed);
}

/**
 * Get head-to-head result between two players
 */
export function getHeadToHead(matches, player1, player2) {
  const match = matches.find(m =>
    (m.player1 === player1 && m.player2 === player2) ||
    (m.player1 === player2 && m.player2 === player1)
  );

  if (!match || !match.completed) return null;

  if (match.player1 === player1) {
    return match.winner === 'player1' ? player1 : player2;
  } else {
    return match.winner === 'player2' ? player1 : player2;
  }
}
