/**
 * coins.js
 * -----------------------------------------------------------------------
 * Generates collectible coins along the terrain, floating just above the
 * surface at a height a driving car actually passes through. Skips
 * placement on steep slopes so every coin is realistically visible and
 * reachable, per spec. Tracks collection and exposes score/count.
 * -----------------------------------------------------------------------
 */

class Coins {
    constructor(terrain, seed) {
        this.list = this._generate(terrain, seed);
        this.collectedCount = 0;
        this.score = 0;
    }

    _generate(terrain, seed) {
        const rng = createRNG(seed + 999); // offset so coin layout isn't identical to terrain's own RNG stream
        const cfg = COIN_CONFIG;
        const coins = [];

        let x = 300; // skip the very start, where the car spawns
        while (x < TERRAIN_CONFIG.worldWidth - 200) {
            const slope = terrain.getSlopeAt(x);
            if (Math.abs(slope) <= cfg.maxSlopeForPlacement) {
                const groundY = terrain.getHeightAt(x);
                coins.push({
                    x,
                    y: groundY - cfg.heightAboveGround,
                    collected: false
                });
            }
            x += cfg.spacingMin + rng() * (cfg.spacingMax - cfg.spacingMin);
        }
        return coins;
    }

    /** Checks the car's chassis + both wheels against every uncollected
     * coin in view and collects any within pickup range. Returns the
     * number newly collected this call (for triggering feedback). */
    checkCollisions(car) {
        const cfg = COIN_CONFIG;
        const carPoints = [car.chassis.position, car.frontWheel.position, car.rearWheel.position];
        let newlyCollected = 0;

        for (const coin of this.list) {
            if (coin.collected) continue;
            for (const p of carPoints) {
                const dx = p.x - coin.x;
                const dy = p.y - coin.y;
                if (Math.hypot(dx, dy) <= cfg.pickupRadius) {
                    coin.collected = true;
                    this.collectedCount++;
                    this.score += cfg.value;
                    newlyCollected++;
                    break;
                }
            }
        }
        return newlyCollected;
    }

    render(ctx, cameraX, viewW, timeMs) {
        const cfg = COIN_CONFIG;
        const bob = Math.sin(timeMs / 300) * 3; // gentle floating bob, purely decorative

        for (const coin of this.list) {
            if (coin.collected) continue;
            const screenX = coin.x - cameraX;
            if (screenX < -30 || screenX > viewW + 30) continue; // offscreen, skip drawing

            ctx.save();
            ctx.translate(screenX, coin.y + bob);
            ctx.fillStyle = '#F4C542'; // warm gold, distinct from the green palette so coins pop
            ctx.strokeStyle = '#B8860B';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, cfg.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = '#FFE9A8';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('★', 0, 0);
            ctx.restore();
        }
    }
}
