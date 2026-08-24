/**
 * progress.js
 * -----------------------------------------------------------------------
 * Shared localStorage progress module for the whole site (main puzzle
 * page + every mini-game). Include this ONE file on every page that
 * needs to read or write progress:
 *
 *   <script src="/progress.js"></script>
 *
 * Then from any page:
 *
 *   SiteProgress.recordRun('carGame', { completed:true, score:120, coins:8, distance:240 });
 *   SiteProgress.get('carGame');           // -> { completed, score, coins, distance, ...defaults }
 *   SiteProgress.getAll();                 // -> the whole progress object
 *
 * -----------------------------------------------------------------------
 * WHY A SEPARATE KEY FROM THE PUZZLE PAGE'S OWN STORAGE
 * -----------------------------------------------------------------------
 * The existing puzzle event page (풋 퍼즐 이벤트) already uses its own
 * localStorage key via system.js for the QR-puzzle-piece tracking. I
 * don't have that file's contents, so — per the integration spec's
 * explicit rule "do not overwrite unrelated existing localStorage data"
 * — this module deliberately uses ITS OWN, clearly separate key
 * ('ssonolGames:progress:v1') rather than guessing at and touching
 * whatever key system.js uses. The two systems can coexist safely.
 *
 * If the puzzle page's real save system should actually be the single
 * source of truth instead (e.g. the puzzle completion should unlock
 * something in the games, or vice versa), that needs system.js's actual
 * key/shape to integrate correctly — safer to keep them separate until
 * that's confirmed than to guess and risk clobbering existing player
 * progress.
 * -----------------------------------------------------------------------
 */

const SiteProgress = (function () {
    const STORAGE_KEY = 'ssonolGames:progress:v1';

    // Per-game default shape. Add a new game here when a new mini-game
    // is added — every other game's saved data is left untouched.
    const GAME_DEFAULTS = {
        carGame: { completed: false, score: 0, bestScore: 0, coins: 0, bestDistance: 0, playCount: 0, lastPlayed: null },
        yabawi: { completed: false, bestStageReached: 0, playCount: 0, lastPlayed: null },
        dodgeBooks: { completed: false, bestDodged: 0, playCount: 0, lastPlayed: null }
    };

    function defaults() {
        // Deep-ish copy so callers can't mutate the shared default object.
        const out = {};
        for (const key in GAME_DEFAULTS) out[key] = { ...GAME_DEFAULTS[key] };
        return out;
    }

    function load() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaults();
            const parsed = JSON.parse(raw);
            // Merge over defaults, per-game, so adding a new game or a
            // new field later never breaks an older saved shape.
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
            // Storage full/disabled/private-browsing — fail silently
            // rather than breaking whichever game called this.
        }
    }

    return {
        /** Returns the full progress object for every game. */
        getAll() {
            return load();
        },

        /** Returns just one game's saved data (with defaults filled in). */
        get(gameId) {
            const all = load();
            return all[gameId] || { ...(GAME_DEFAULTS[gameId] || {}) };
        },

        /**
         * Merges `patch` into the given game's saved data and persists
         * immediately. Numeric fields prefixed "best" are auto-maxed
         * against the existing value rather than overwritten, so callers
         * can just pass this run's raw score/distance/etc without having
         * to fetch-then-compare themselves.
         */
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

        /** Resets ONE game's progress. Never touches other games or any
         * unrelated localStorage key. */
        reset(gameId) {
            const all = load();
            all[gameId] = { ...(GAME_DEFAULTS[gameId] || {}) };
            save(all);
        }
    };
})();
