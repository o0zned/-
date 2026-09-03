/**
 * physics.js
 * -----------------------------------------------------------------------
 * Owns the Matter.js engine/world and the terrain's COLLISION
 * representation (separate from terrain.js's visual curve).
 *
 * Terrain collision approach: rather than building one large concave
 * polygon (which Matter can't handle without an extra decomposition
 * library), we walk along the sampled terrain curve and lay down a
 * chain of thin, rotated STATIC RECTANGLES, each one hugging the local
 * slope of the curve beneath it. This is a standard, cheap technique
 * for 2D side-scroller ground collision — no extra dependencies, no
 * concave-hull math, and it naturally handles hills AND pits since each
 * rectangle just follows whatever angle its two endpoints define.
 * -----------------------------------------------------------------------
 */

const Physics = {
    engine: null,
    world: null,
    terrainBodies: [],
    carCollisionGroup: null,

    init() {
        this.engine = Matter.Engine.create({
            gravity: PHYSICS_CONFIG.gravity
        });
        this.engine.positionIterations = PHYSICS_CONFIG.positionIterations;
        this.engine.velocityIterations = PHYSICS_CONFIG.velocityIterations;
        this.world = this.engine.world;

        // All car parts (chassis + both wheels) share this negative
        // collision group, which makes Matter skip collision checks
        // between them entirely — otherwise the wheels and chassis,
        // being physically overlapping-ish by design, would constantly
        // collide with each other and make the car explode/jitter.
        this.carCollisionGroup = Matter.Body.nextGroup(true);
    },

    /**
     * Removes any previously-built terrain collision bodies and builds a
     * fresh chain from the given Terrain instance. Call this whenever
     * terrain is (re)generated.
     */
    buildTerrainCollision(terrain) {
        if (this.terrainBodies.length > 0) {
            Matter.Composite.remove(this.world, this.terrainBodies);
            this.terrainBodies = [];
        }

        const step = TERRAIN_CONFIG.physicsSegmentStep;
        const thickness = TERRAIN_CONFIG.physicsSegmentThickness;
        const points = terrain.sample(0, TERRAIN_CONFIG.worldWidth, step);

        for (let i = 0; i < points.length - 1; i++) {
            const p1 = points[i];
            const p2 = points[i + 1];
            const dx = p2.x - p1.x;
            const dy = p2.y - p1.y;
            const length = Math.hypot(dx, dy);
            const angle = Math.atan2(dy, dx);

            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;

            // Push the rectangle's center DOWN along the surface normal
            // by half its thickness, so its TOP edge lines up with the
            // sampled curve instead of the curve running through its
            // middle (which would let the visual terrain and the actual
            // collision surface disagree by half the thickness).
            const normalX = -Math.sin(angle);
            const normalY = Math.cos(angle);
            const centerX = midX + normalX * (thickness / 2);
            const centerY = midY + normalY * (thickness / 2);

            const segment = Matter.Bodies.rectangle(
                centerX, centerY,
                length + 2, // slight overlap so adjacent segments don't leave a seam gap
                thickness,
                {
                    isStatic: true,
                    angle,
                    friction: TERRAIN_CONFIG.groundFriction,
                    label: 'terrainSegment'
                }
            );
            this.terrainBodies.push(segment);
        }

        Matter.Composite.add(this.world, this.terrainBodies);
    },

    /**
     * Advances the simulation. Delta is clamped so a slow/backgrounded
     * frame can't fling bodies through the world in one giant step.
     */
    step(deltaMs) {
        const clamped = Math.min(deltaMs, PHYSICS_CONFIG.maxDeltaMs);
        Matter.Engine.update(this.engine, clamped);
    }
};
