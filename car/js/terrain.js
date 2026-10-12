function createRNG(seed) {
    let a = seed >>> 0;
    return function () {
        a |= 0; a = (a + 0x6D2B79F5) | 0;
        let t = Math.imul(a ^ (a >>> 15), 1 | a);
        t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
        return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
}

function pickWeighted(rng, weights) {
    const entries = Object.entries(weights);
    const total = entries.reduce((s, [, w]) => s + w, 0);
    let r = rng() * total;
    for (const [key, w] of entries) {
        if (r < w) return key;
        r -= w;
    }
    return entries[entries.length - 1][0];
}

function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
}

function lerp(a, b, t) { return a + (b - a) * t; }

function generateControlPoints(seed, cfg) {
    const rng = createRNG(seed);
    const points = [{ x: 0, y: cfg.startHeight }];
    let consecutiveFlats = 0;

    function progressAt(x) {
        return clamp(x / cfg.worldWidth, 0, 1);
    }

    function applySlopeClamp(deltaY, segWidth, progress) {
        const currentMaxSlope = lerp(cfg.maxSlopeStart, cfg.maxSlopeEnd, progress);
        const maxDelta = segWidth * currentMaxSlope;
        return clamp(deltaY, -maxDelta, maxDelta);
    }

    function pushPoint(prev, segWidth, rawDeltaY) {
        const progress = progressAt(prev.x);
        const deltaY = applySlopeClamp(rawDeltaY, segWidth, progress);
        const newY = clamp(prev.y + deltaY, cfg.minHeight, cfg.maxHeight);
        const p = { x: prev.x + segWidth, y: newY };
        points.push(p);
        return p;
    }

    while (points[points.length - 1].x < cfg.worldWidth) {
        const prev = points[points.length - 1];
        const progress = progressAt(prev.x);
        const segWidth = lerpRandom(rng, cfg.minSegmentWidth, cfg.maxSegmentWidth);

        let excluded = [];
        if (consecutiveFlats >= 2) excluded.push('flat');

        const margin = 40;
        if (prev.y - cfg.minHeight < margin) { excluded.push('hill', 'gentleUp'); }
        if (cfg.maxHeight - prev.y < margin) { excluded.push('pit', 'gentleDown'); }

        let feature = pickWeighted(rng, cfg.featureWeights);
        if (excluded.includes(feature)) {
            const filtered = { ...cfg.featureWeights };
            for (const key of excluded) delete filtered[key];

            feature = Object.keys(filtered).length > 0
                ? pickWeighted(rng, filtered)
                : 'flat';
        }
        consecutiveFlats = (feature === 'flat') ? consecutiveFlats + 1 : 0;

        const hillRange = [
            lerp(cfg.hillHeightRangeStart[0], cfg.hillHeightRangeEnd[0], progress),
            lerp(cfg.hillHeightRangeStart[1], cfg.hillHeightRangeEnd[1], progress)
        ];
        const pitRange = [
            lerp(cfg.pitDepthRangeStart[0], cfg.pitDepthRangeEnd[0], progress),
            lerp(cfg.pitDepthRangeStart[1], cfg.pitDepthRangeEnd[1], progress)
        ];

        let rawDeltaY = 0;
        switch (feature) {
            case 'flat':

                rawDeltaY = lerpRandom(rng, -8, 8);
                break;
            case 'gentleUp':
                rawDeltaY = -lerpRandom(rng, 15, 60);
                break;
            case 'gentleDown':
                rawDeltaY = lerpRandom(rng, 15, 60);
                break;
            case 'hill':
                rawDeltaY = -lerpRandom(rng, hillRange[0], hillRange[1]);
                break;
            case 'pit':
                rawDeltaY = lerpRandom(rng, pitRange[0], pitRange[1]);
                break;
        }

        const newPoint = pushPoint(prev, segWidth, rawDeltaY);

        if (feature === 'hill' || feature === 'pit') {
            const dir = feature === 'hill' ? 1 : -1;
            for (let i = 0; i < 2; i++) {
                const landWidth = lerpRandom(rng, cfg.minSegmentWidth, cfg.maxSegmentWidth);
                const landDelta = dir * lerpRandom(rng, 20, 55);
                pushPoint(points[points.length - 1], landWidth, landDelta);
            }
        }
    }

    return smoothPoints(points, cfg.smoothingPasses, cfg.smoothingStrength);
}

function smoothPoints(points, passes, strength = 1.0) {
    let pts = points;
    for (let pass = 0; pass < passes; pass++) {
        const next = [pts[0]];
        for (let i = 1; i < pts.length - 1; i++) {
            const avgY = (pts[i - 1].y + pts[i].y + pts[i + 1].y) / 3;
            const blendedY = pts[i].y * (1 - strength) + avgY * strength;
            next.push({ x: pts[i].x, y: blendedY });
        }
        next.push(pts[pts.length - 1]);
        pts = next;
    }
    return pts;
}

function lerpRandom(rng, min, max) {
    return min + rng() * (max - min);
}

function catmullRom(p0, p1, p2, p3, t) {
    const t2 = t * t;
    const t3 = t2 * t;
    return 0.5 * (
        (2 * p1) +
        (-p0 + p2) * t +
        (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 +
        (-p0 + 3 * p1 - 3 * p2 + p3) * t3
    );
}

class Terrain {
    constructor(seed = 1, viewportHeight = 400) {
        this.seed = seed;
        this.viewportHeight = viewportHeight;
        this.config = this._resolveConfig(viewportHeight);
        this.points = generateControlPoints(seed, this.config);
    }

    _resolveConfig(viewportHeight) {
        const r = TERRAIN_CONFIG.heightRatio;
        return {
            ...TERRAIN_CONFIG,
            minHeight: viewportHeight * r.min,
            maxHeight: viewportHeight * r.max,
            startHeight: viewportHeight * r.start
        };
    }

    regenerate(seed, viewportHeight = this.viewportHeight) {
        this.seed = seed;
        this.viewportHeight = viewportHeight;
        this.config = this._resolveConfig(viewportHeight);
        this.points = generateControlPoints(seed, this.config);
    }

    onViewportResize(viewportHeight) {
        if (Math.abs(viewportHeight - this.viewportHeight) < 2) return;
        this.regenerate(this.seed, viewportHeight);
    }

    getHeightAt(x) {
        const pts = this.points;
        if (x <= pts[0].x) return pts[0].y;
        if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

        let i = 0;

        while (i < pts.length - 2 && pts[i + 1].x < x) i++;

        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];

        const t = (x - p1.x) / (p2.x - p1.x);
        return catmullRom(p0.y, p1.y, p2.y, p3.y, t);
    }

    sample(worldXStart, worldXEnd, step = this.config.sampleStep) {
        const out = [];
        for (let x = worldXStart; x <= worldXEnd; x += step) {
            out.push({ x, y: this.getHeightAt(x) });
        }
        return out;
    }

    getSlopeAt(x, h = TERRAIN_CONFIG.slopeSampleH) {
        const yPlus = this.getHeightAt(x + h);
        const yMinus = this.getHeightAt(x - h);
        return (yPlus - yMinus) / (2 * h);
    }

    getThetaAt(x, h = TERRAIN_CONFIG.slopeSampleH) {
        return Math.atan(this.getSlopeAt(x, h));
    }
}
