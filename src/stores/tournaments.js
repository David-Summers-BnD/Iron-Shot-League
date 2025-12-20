import { writable, derived } from 'svelte/store';

// Current active tab/page
export const currentTab = writable('round-robin');

// All tournaments stored
export const tournaments = writable([]);

// Current tournament being edited/viewed
export const currentTournament = writable(null);

// Tournament types configuration
export const tournamentTypes = [
  { id: 'round-robin', name: 'Round Robin', icon: '🔄', description: 'Everyone plays everyone' },
  { id: 'single-elimination', name: 'Single Elimination', icon: '🏆', description: 'Lose once, you\'re out' },
  { id: 'double-elimination', name: 'Double Elimination', icon: '🎯', description: 'Two chances to win' },
  { id: 'race-to-x', name: 'Race to X', icon: '🏁', description: 'First to X wins' },
  { id: 'ladder', name: 'Ladder', icon: '📊', description: 'Challenge your way up' },
  { id: 'swiss', name: 'Swiss System', icon: '🎲', description: 'Play similar skill levels' },
  { id: 'scotch-doubles', name: 'Scotch Doubles', icon: '👥', description: 'Team alternating shots' },
  { id: 'killer', name: 'Killer', icon: '💀', description: 'Last player standing wins' },
  { id: 'history', name: 'History', icon: '📜', description: 'Past tournaments' }
];

// Filter active tournaments
export const activeTournaments = derived(tournaments, $tournaments =>
  $tournaments.filter(t => t.status !== 'completed')
);

// Filter completed tournaments
export const completedTournaments = derived(tournaments, $tournaments =>
  $tournaments.filter(t => t.status === 'completed')
);

// Create a new tournament
export function createTournament(type, name, players, config = {}) {
  const tournament = {
    id: crypto.randomUUID(),
    type,
    name,
    players,
    config,
    status: 'setup',
    createdAt: new Date().toISOString(),
    matches: [],
    results: [],
    standings: []
  };

  tournaments.update(list => [...list, tournament]);
  currentTournament.set(tournament);

  return tournament;
}

// Update tournament
export function updateTournament(id, updates) {
  tournaments.update(list =>
    list.map(t => t.id === id ? { ...t, ...updates } : t)
  );

  currentTournament.update(t => {
    if (t && t.id === id) {
      return { ...t, ...updates };
    }
    return t;
  });
}

// Delete tournament
export function deleteTournament(id) {
  tournaments.update(list => list.filter(t => t.id !== id));
  currentTournament.update(t => t && t.id === id ? null : t);
}
