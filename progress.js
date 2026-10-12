const SiteProgress = (function () {
    const STORAGE_KEY = 'ssonolGames:progress:v1';

    const GAME_DEFAULTS = {
        carGame: { completed: false, score: 0, bestScore: 0, coins: 0, bestDistance: 0, playCount: 0, lastPlayed: null },
        yabawi: { completed: false, bestStageReached: 0, playCount: 0, lastPlayed: null },
        dodgeBooks: { completed: false, bestDodged: 0, playCount: 0, lastPlayed: null }
    };

    function defaults() {

        const out = {};
        for (const key in GAME_DEFAULTS) out[key] = { ...GAME_DEFAULTS[key] };
        return out;
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaults();
            const parsed = JSON.parse(raw);

            const merged = defaults();
            for (const gameId in parsed) {
                merged[gameId] = { ...(merged[gameId] || {}), ...parsed[gameId] };
            }
            return merged;
        } catch (e) {
            return defaults();
        }
    }

    function save(data) {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
        } catch (e) {

        }
    }

    return {

        getAll() {
            return load();
        },

        get(gameId) {
            const all = load();
            return all[gameId] || { ...(GAME_DEFAULTS[gameId] || {}) };
        },

        recordRun(gameId, patch) {
            const all = load();
            const current = all[gameId] || { ...(GAME_DEFAULTS[gameId] || {}) };
            const next = { ...current };

            for (const key in patch) {
                if (key.startsWith('best') && typeof patch[key] === 'number') {
                    next[key] = Math.max(current[key] || 0, patch[key]);
                } else {
                    next[key] = patch[key];
                }
            }
            next.playCount = (current.playCount || 0) + 1;
            next.lastPlayed = new Date().toISOString();

            all[gameId] = next;
            save(all);
            return next;
        },

        reset(gameId) {
            const all = load();
            all[gameId] = { ...(GAME_DEFAULTS[gameId] || {}) };
            save(all);
        }
    };
})();
