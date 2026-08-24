/**
 * terrain.js
 * -----------------------------------------------------------------------
 * Procedural terrain generation for Phase 1.
 *
 * Approach:
 *   1. Walk left-to-right generating "control points" (x, y). Each new
 *      point is produced by picking a terrain *feature* (flat, gentle
 *      slope, hill, pit) and applying a height change that is clamped
 *      to sane limits — never a fully arbitrary random jump. This is
 *      what keeps the terrain "designed" rather than noisy.
 *   2. Connect those control points with a Catmull-Rom spline, which
 *      passes smoothly *through* every control point with continuous
 *      slope (no seams, no sharp spikes). This is a standard technique
 *      for exactly this kind of terrain and is cheap to evaluate.
 *   3. Expose getTerrainHeight(x) so anything in the game (renderer now,
 *      physics later) can ask "what's the ground height at this x?"
 *      without caring how the curve was built.
 *
 * A seeded PRNG (mulberry32) means the same seed always reproduces the
 * same terrain, per spec.
 * -----------------------------------------------------------------------
 */

// ---- Seeded PRNG ---------------------------------------------------------
// mulberry32: tiny, fast, good-enough statistical quality for game terrain.
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

/**
 * Generates the array of control points for the whole world width.
 * Each point: { x, y }
 */
function generateControlPoints(seed, cfg) {
    const rng = createRNG(seed);
    const points = [{ x: 0, y: cfg.startHeight }];
    let consecutiveFlats = 0;

    // How far through the level a given x is, 0 (spawn) to 1 (finish).
    // Every difficulty knob below scales off this, which is what makes
    // the run start gentle and ramp up toward the finish line.
    function progressAt(x) {
        return clamp(x / cfg.worldWidth, 0, 1);
    }

    // Every proposed deltaY passes through this before being applied.
    // This is the actual anti-spike mechanism: no matter which feature
    // picked a large height change, it gets capped to what the segment's
    // width can support at the CURRENT (progress-scaled) max slope. A
    // short segment simply cannot produce a steep jump.
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

        // Cap consecutive 'flat' picks at 2. 'flat' only wobbles ±8px,
        // so 3+ in a row (which DOES happen by chance at 32% weight —
        // confirmed by simulation) reads as a long, boring, suspiciously
        // straight stretch. Forcing a re-pick without 'flat' once we've
        // had two in a row keeps every section visually alive.
        let excluded = [];
        if (consecutiveFlats >= 2) excluded.push('flat');

        // THE actual bug behind "long straight sections": near the
        // top/bottom height boundary, a 'hill'/'gentleUp' (or
        // 'pit'/'gentleDown') pick gets silently flattened by the
        // minHeight/maxHeight clamp in pushPoint — the feature LOOKS
        // like it should move the terrain, but the clamp pins it at
        // the exact same boundary value for point after point, which
        // is indistinguishable on screen from a straight plateau.
        // Fix: once we're within margin of a boundary, don't even
        // offer features that would push further past it.
        const margin = 40;
        if (prev.y - cfg.minHeight < margin) { excluded.push('hill', 'gentleUp'); }
        if (cfg.maxHeight - prev.y < margin) { excluded.push('pit', 'gentleDown'); }

        let feature = pickWeighted(rng, cfg.featureWeights);
        if (excluded.includes(feature)) {
            const filtered = { ...cfg.featureWeights };
            for (const key of excluded) delete filtered[key];
            // Safety net: on an extremely short viewport, the height
            // range can be so small that BOTH boundary exclusions (near
            // minHeight AND near maxHeight) fire in the same iteration,
            // potentially excluding every single feature. An empty
            // weights object has nothing for pickWeighted to return,
            // which crashed with "Cannot read properties of undefined"
            // — confirmed by simulating short viewports. Falling back
            // to 'flat' (the safest possible choice — it barely moves
            // the terrain at all) guarantees there's always something
            // valid to pick, no matter how cramped the screen is.
            feature = Object.keys(filtered).length > 0
                ? pickWeighted(rng, filtered)
                : 'flat';
        }
        consecutiveFlats = (feature === 'flat') ? consecutiveFlats + 1 : 0;

        // Interpolated per-progress hill/pit intensity ranges.
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
                // Tiny wobble so it doesn't look perfectly dead-flat.
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

        // After a hill/pit peak, spread the "landing" over TWO gentler
        // points instead of one — this is what turns a sharp /\ shape
        // into a rounded, driveable bump. Each landing step is also
        // slope-clamped, so it can never overshoot back into a spike.
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

/**
 * Simple 3-point moving-average smoothing over the y values, blended by
 * `strength` (0 = no smoothing at all, 1 = full average). Run for a few
 * passes. Endpoints are left untouched so the terrain still starts
 * exactly at startHeight. Using a blend strength instead of just an
 * integer pass count gives much finer control between "0 passes"
 * (measured: spline overshoot up to ~42° at hill peaks, guaranteed
 * crashes) and "1 full pass" (measured: ~30°, felt too tame) — this
 * lets us land in between instead of being stuck picking one or the
 * other.
 */
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

/**
 * Catmull-Rom spline interpolation through 4 control points (p0..p3),
 * evaluated at t in [0,1] for the segment between p1 and p2.
 * Standard uniform Catmull-Rom formula — smooth, passes through every
 * control point, continuous first derivative (no visible seams).
 */
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

/**
 * Terrain class: owns the control points and answers height queries.
 */
class Terrain {
    constructor(seed = 1, viewportHeight = 400) {
        this.seed = seed;
        this.viewportHeight = viewportHeight;
        this.config = this._resolveConfig(viewportHeight);
        this.points = generateControlPoints(seed, this.config);
    }

    /**
     * Turns the ratio-based heightRatio settings into concrete pixel
     * bounds for THIS viewport height. Called on init and whenever the
     * screen size/orientation changes.
     */
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

    /**
     * Re-resolves height bounds for a new viewport size (e.g. orientation
     * change) and regenerates so the terrain still fits, keeping the same
     * seed so it's not a jarringly different layout — just rescaled.
     */
    onViewportResize(viewportHeight) {
        if (Math.abs(viewportHeight - this.viewportHeight) < 2) return; // no meaningful change
        this.regenerate(this.seed, viewportHeight);
    }

    /**
     * Returns terrain height (y) at any world x-coordinate using
     * Catmull-Rom interpolation between the surrounding control points.
     * Outside the generated range, clamps to the nearest edge point.
     */
    getHeightAt(x) {
        const pts = this.points;
        if (x <= pts[0].x) return pts[0].y;
        if (x >= pts[pts.length - 1].x) return pts[pts.length - 1].y;

        // Find the segment [i, i+1] containing x.
        let i = 0;
        // Linear scan is fine at Phase-1 scale; can be binary-searched
        // later if profiling ever shows it matters.
        while (i < pts.length - 2 && pts[i + 1].x < x) i++;

        const p0 = pts[Math.max(0, i - 1)];
        const p1 = pts[i];
        const p2 = pts[i + 1];
        const p3 = pts[Math.min(pts.length - 1, i + 2)];

        const t = (x - p1.x) / (p2.x - p1.x);
        return catmullRom(p0.y, p1.y, p2.y, p3.y, t);
    }

    /**
     * Convenience: precompute a dense sampled polyline between
     * worldXStart and worldXEnd for fast rendering.
     */
    sample(worldXStart, worldXEnd, step = this.config.sampleStep) {
        const out = [];
        for (let x = worldXStart; x <= worldXEnd; x += step) {
            out.push({ x, y: this.getHeightAt(x) });
        }
        return out;
    }

    /**
     * Local terrain slope at x, via central difference numerical
     * differentiation:
     *
     *     slope ≈ (f(x+h) - f(x-h)) / (2h)
     *
     * We use this instead of an exact derivative because the terrain
     * curve (Catmull-Rom, seed-dependent) has no fixed symbolic formula
     * to differentiate — central difference works on ANY getHeightAt
     * implementation, so it stays correct even if terrain generation
     * changes later.
     *
     * A NOTE ON SIGN/CONVENTION: canvas y grows DOWNWARD. So if the car
     * is moving in +x and slope > 0, the ground is getting lower on
     * screen — meaning downhill in the direction of travel. That's the
     * convention the physics system should assume in Phase 4+ (downhill
     * → positive slope → gravity should accelerate the car forward).
     *
     * h defaults to TERRAIN_CONFIG.slopeSampleH — small enough to be
     * locally accurate, large enough to not amplify floating point
     * noise from the spline evaluation.
     */
    getSlopeAt(x, h = TERRAIN_CONFIG.slopeSampleH) {
        const yPlus = this.getHeightAt(x + h);
        const yMinus = this.getHeightAt(x - h);
        return (yPlus - yMinus) / (2 * h);
    }

    /**
     * Local terrain angle (radians) from horizontal, derived from slope:
     *
     *     theta = atan(slope)
     *
     * This is the actual angle a car body should rotate to sit flush
     * with the ground, and (later) the angle used to resolve gravity
     * into components parallel/perpendicular to the surface.
     */
    getThetaAt(x, h = TERRAIN_CONFIG.slopeSampleH) {
        return Math.atan(this.getSlopeAt(x, h));
    }
}
