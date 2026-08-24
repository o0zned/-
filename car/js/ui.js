/**
 * ui.js
 * -----------------------------------------------------------------------
 * Phase 1 UI: just the header + a small dev panel for regenerating
 * terrain with a new/specific seed, so you can eyeball a bunch of
 * generated terrains on your phone before physics ever touches it.
 * Touch controls (accelerate/brake) get added here in Phase 7.
 * -----------------------------------------------------------------------
 */

const UI = {
    seedInput: null,
    seedLabel: null,

    init(onRegenerate) {
        this.seedInput = document.getElementById('seed-input');
        this.seedLabel = document.getElementById('seed-label');

        document.getElementById('regen-btn').addEventListener('click', () => {
            const seed = Math.floor(Math.random() * 1_000_000);
            this.seedInput.value = seed;
            this.setSeedLabel(seed);
            onRegenerate(seed);
        });

        document.getElementById('use-seed-btn').addEventListener('click', () => {
            const seed = parseInt(this.seedInput.value, 10) || 1;
            this.setSeedLabel(seed);
            onRegenerate(seed);
        });
    },

    setSeedLabel(seed) {
        this.seedLabel.textContent = `시드 Seed: ${seed}`;
    }
};
