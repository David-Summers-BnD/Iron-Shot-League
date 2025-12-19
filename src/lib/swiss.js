/**
 * Create initial Swiss tournament state
 */
export function createSwissTournament(players, numRounds) {
  // Calculate default rounds if not specified
  const defaultRounds = Math.ceil(Math.log2(players.length)) + 1;
  const rounds = numRounds || defaultRounds;

  return {
    players: players.map(player => ({
      name: player,
      points: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      opponents: [],
      buchholz: 0 // Tiebreaker: sum of opponents' scores
    })),
    rounds: [],
    currentRound: 0,
    totalRounds: rounds,
    completed: false
  };
}

/**
 * Generate pairings for the next round using Swiss system
 */
export function generateNextRound(tournament) {
  const { players, currentRound, totalRounds } = tournament;

  if (currentRound >= totalRounds) {
    return { ...tournament, completed: true };
  }

  const roundNumber = currentRound + 1;

  // Sort players by points (descending), then by tiebreakers
  const sortedPlayers = [...players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return b.buchholz - a.buchholz;
  });

  const paired = new Set();
  const matches = [];

  for (let i = 0; i < sortedPlayers.length; i++) {
    const player1 = sortedPlayers[i];

    if (paired.has(player1.name)) continue;

    // Find best opponent: similar score, hasn't played them yet
    let opponent = null;

    for (let j = i + 1; j < sortedPlayers.length; j++) {
      const candidate = sortedPlayers[j];

      if (paired.has(candidate.name)) continue;
      if (player1.opponents.includes(candidate.name)) continue;

      opponent = candidate;
      break;
    }

    if (opponent) {
      paired.add(player1.name);
      paired.add(opponent.name);

      matches.push({
        id: crypto.randomUUID(),
        round: roundNumber,
        player1: player1.name,
        player2: opponent.name,
        score1: null,
        score2: null,
        winner: null,
        completed: false
      });
    }
  }

  // Handle bye if odd number of players
  if (sortedPlayers.length % 2 === 1) {
    const byePlayer = sortedPlayers.find(p => !paired.has(p.name));
    if (byePlayer) {
      // Give bye to lowest ranked unpaired player
      matches.push({
        id: crypto.randomUUID(),
        round: roundNumber,
        player1: byePlayer.name,
        player2: 'BYE',
        score1: 1,
        score2: 0,
        winner: 'player1',
        completed: true
      });

      // Award point for bye
      const playerIdx = tournament.players.findIndex(p => p.name === byePlayer.name);
      if (playerIdx !== -1) {
        tournament.players[playerIdx].points += 1;
        tournament.players[playerIdx].wins += 1;
      }
    }
  }

  return {
    ...tournament,
    rounds: [...tournament.rounds, { number: roundNumber, matches }],
    currentRound: roundNumber
  };
}

/**
 * Record match result
 */
export function recordResult(tournament, matchId, score1, score2, winner) {
  const newTournament = { ...tournament };

  for (const round of newTournament.rounds) {
    for (const match of round.matches) {
      if (match.id === matchId) {
        match.score1 = score1;
        match.score2 = score2;
        match.winner = winner;
        match.completed = true;

        // Update player stats
        const p1Idx = newTournament.players.findIndex(p => p.name === match.player1);
        const p2Idx = newTournament.players.findIndex(p => p.name === match.player2);

        if (p1Idx !== -1 && p2Idx !== -1 && match.player2 !== 'BYE') {
          // Record opponents
          newTournament.players[p1Idx].opponents.push(match.player2);
          newTournament.players[p2Idx].opponents.push(match.player1);

          // Update points and records
          if (winner === 'player1') {
            newTournament.players[p1Idx].points += 1;
            newTournament.players[p1Idx].wins += 1;
            newTournament.players[p2Idx].losses += 1;
          } else if (winner === 'player2') {
            newTournament.players[p2Idx].points += 1;
            newTournament.players[p2Idx].wins += 1;
            newTournament.players[p1Idx].losses += 1;
          } else {
            // Draw
            newTournament.players[p1Idx].points += 0.5;
            newTournament.players[p2Idx].points += 0.5;
            newTournament.players[p1Idx].draws += 1;
            newTournament.players[p2Idx].draws += 1;
          }
        }

        break;
      }
    }
  }

  // Update Buchholz scores (tiebreaker)
  updateBuchholz(newTournament);

  return newTournament;
}

/**
 * Update Buchholz tiebreaker scores
 */
function updateBuchholz(tournament) {
  for (const player of tournament.players) {
    let buchholz = 0;
    for (const oppName of player.opponents) {
      const opp = tournament.players.find(p => p.name === oppName);
      if (opp) {
        buchholz += opp.points;
      }
    }
    player.buchholz = buchholz;
  }
}

/**
 * Get current standings
 */
export function getStandings(tournament) {
  return [...tournament.players].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    if (b.buchholz !== a.buchholz) return b.buchholz - a.buchholz;
    return b.wins - a.wins;
  });
}

/**
 * Check if round is complete
 */
export function isRoundComplete(tournament) {
  if (tournament.rounds.length === 0) return true;
  const currentRound = tournament.rounds[tournament.rounds.length - 1];
  return currentRound.matches.every(m => m.completed);
}

/**
 * Check if tournament is complete
 */
export function isTournamentComplete(tournament) {
  return tournament.currentRound >= tournament.totalRounds && isRoundComplete(tournament);
}
