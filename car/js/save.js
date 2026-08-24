/**
 * save.js
 * -----------------------------------------------------------------------
 * Adapter over the site-wide SiteProgress module (see /progress.js,
 * meant to be included on the main site + every mini-game once deployed
 * together). game.js always calls SaveSystem.recordRun({score, coins,
 * distance, completed}) the same way regardless of which backing store
 * is actually used.
 *
 * IMPORTANT: this file is defensive about SiteProgress NOT being
 * available — e.g. when this car-game folder is opened/tested on its
 * own (via file:// or a bare static server) rather than deployed
 * alongside the real site's /progress.js. In that case it falls back to
 * a standalone localStorage key scoped to just this game, so the game
 * never throws/crashes over a missing shared module. Once actually
 * deployed next to /progress.js, it automatically uses the shared store
 * instead — no code change needed.
 * -----------------------------------------------------------------------
 */

const SaveSystem = {
    _gameId: 'carGame',
    _fallbackKey: 'ssonolGames:footRacer:standalone:v1',

    _hasSiteProgress() {
        return typeof SiteProgress !== 'undefined';
    },

    _fallbackDefaults() {
        return { completed: false, score: 0, bestScore: 0, coins: 0, bestDistance: 0, playCount: 0, lastPlayed: null };
    },

    _fallbackLoad() {
        try {
            const raw = localStorage.getItem(this._fallbackKey);
            if (!raw) return this._fallbackDefaults();
            return { ...this._fallbackDefaults(), ...JSON.parse(raw) };
        } catch (e) {
            return this._fallbackDefaults();
        }
    },

    _fallbackSave(data) {
        try { localStorage.setItem(this._fallbackKey, JSON.stringify(data)); } catch (e) {}
    },

    load() {
        if (this._hasSiteProgress()) return SiteProgress.get(this._gameId);
        return this._fallbackLoad();
    },

    recordRun({ score, coins, distance, completed }) {
        if (this._hasSiteProgress()) {
            return SiteProgress.recordRun(this._gameId, {
                score, bestScore: score, coins, bestDistance: distance, distance, completed
            });
        }
        // Standalone fallback: same max-of-best-fields behavior as SiteProgress.
        const data = this._fallbackLoad();
        data.score = score;
        data.bestScore = Math.max(data.bestScore || 0, score);
        data.coins = coins;
        data.distance = distance;
        data.bestDistance = Math.max(data.bestDistance || 0, distance);
        data.completed = completed;
        data.playCount = (data.playCount || 0) + 1;
        data.lastPlayed = new Date().toISOString();
        this._fallbackSave(data);
        return data;
    },

    reset() {
        if (this._hasSiteProgress()) { SiteProgress.reset(this._gameId); return; }
        try { localStorage.removeItem(this._fallbackKey); } catch (e) {}
    }
};
