import localforage from 'localforage';

// Configure localForage
localforage.config({
  name: 'IronShotLeague',
  storeName: 'tournaments',
  description: 'Iron Shot League tournament data'
});

const TOURNAMENTS_KEY = 'tournaments';
const SETTINGS_KEY = 'settings';

// Save tournaments to storage
export async function saveTournaments(tournaments) {
  try {
    await localforage.setItem(TOURNAMENTS_KEY, tournaments);
    return true;
  } catch (error) {
    console.error('Failed to save tournaments:', error);
    return false;
  }
}

// Load tournaments from storage
export async function loadTournaments() {
  try {
    const tournaments = await localforage.getItem(TOURNAMENTS_KEY);
    return tournaments || [];
  } catch (error) {
    console.error('Failed to load tournaments:', error);
    return [];
  }
}

// Save settings
export async function saveSettings(settings) {
  try {
    await localforage.setItem(SETTINGS_KEY, settings);
    return true;
  } catch (error) {
    console.error('Failed to save settings:', error);
    return false;
  }
}

// Load settings
export async function loadSettings() {
  try {
    const settings = await localforage.getItem(SETTINGS_KEY);
    return settings || {};
  } catch (error) {
    console.error('Failed to load settings:', error);
    return {};
  }
}

// Export all data as JSON
export async function exportData() {
  const tournaments = await loadTournaments();
  const settings = await loadSettings();

  const data = {
    version: '1.0',
    exportedAt: new Date().toISOString(),
    tournaments,
    settings
  };

  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);

  const a = document.createElement('a');
  a.href = url;
  a.download = `iron-shot-league-backup-${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Import data from JSON file
export async function importData(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = async (e) => {
      try {
        const data = JSON.parse(e.target.result);

        if (!data.version || !data.tournaments) {
          reject(new Error('Invalid backup file format'));
          return;
        }

        await saveTournaments(data.tournaments);
        if (data.settings) {
          await saveSettings(data.settings);
        }

        resolve(data.tournaments);
      } catch (error) {
        reject(new Error('Failed to parse backup file'));
      }
    };

    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsText(file);
  });
}

// Clear all data
export async function clearAllData() {
  try {
    await localforage.clear();
    return true;
  } catch (error) {
    console.error('Failed to clear data:', error);
    return false;
  }
}
