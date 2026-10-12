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
