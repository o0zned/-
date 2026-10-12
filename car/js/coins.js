const coinImg = new Image();
let coinImgReady = false;
coinImg.onload = () => { coinImgReady = true; };
coinImg.src = '/assets/car/coin.png';

class Coins {
    constructor(terrain, seed) {
        this.list = this._generate(terrain, seed);
        this.collectedCount = 0;
        this.score = 0;
    }

    _generate(terrain, seed) {
        const rng = createRNG(seed + 999);
        const cfg = COIN_CONFIG;
        const coins = [];

        let x = 300;
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
        const bob = Math.sin(timeMs / 300) * 3;

        for (const coin of this.list) {
            if (coin.collected) continue;
            const screenX = coin.x - cameraX;
            if (screenX < -30 || screenX > viewW + 30) continue;

            ctx.save();
            ctx.translate(screenX, coin.y + bob);
            if (coinImgReady && coinImg.naturalWidth) {
                const d = cfg.radius * 2;
                ctx.drawImage(coinImg, -d / 2, -d / 2, d, d);
            } else {

                ctx.fillStyle = '#F4C542';
                ctx.strokeStyle = '#B8860B';
                ctx.lineWidth = 2;
                ctx.beginPath();
                ctx.arc(0, 0, cfg.radius, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
            ctx.restore();
        }
    }
}
