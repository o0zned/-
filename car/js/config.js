/**
 * config.js
 * -----------------------------------------------------------------------
 * All important tunable numbers live here so the rest of the codebase
 * never has magic numbers scattered through it. Phase 1 only needs
 * TERRAIN_CONFIG and RENDER_CONFIG. CAR_CONFIG / PHYSICS_CONFIG will be
 * added in Phase 3-4 without touching this file's existing shape.
 * -----------------------------------------------------------------------
 */

// ---- Terrain generation -------------------------------------------------
const TERRAIN_CONFIG = {
    // Horizontal distance (px) between generated control points.
    // Randomized per-segment within this range. Widened from Phase 1's
    // first pass — more horizontal room per segment is what actually
    // prevents "spiky" terrain, more than clamping height alone does.
    minSegmentWidth: 110,
    maxSegmentWidth: 220,

    // Vertical bounds are expressed as RATIOS of the actual canvas height,
    // not fixed pixels. Fixed pixels (the Phase-1 first pass) meant that
    // on a shorter phone screen, a deep pit's y-value could exceed the
    // visible canvas height entirely — the screen would just fill solid
    // green with the "dip" happening below what's ever drawn. Ratios
    // guarantee the terrain surface always stays inside the visible
    // viewport no matter the device.
    //
    //   0.0 = very top of screen, 1.0 = very bottom of screen.
    //
    // min further down than 0 leaves room for the sky + HUD; max stops
    // well short of 1.0 so there's always some green visible even at the
    // deepest pit (never literally flush with the bottom edge).
    heightRatio: {
        min: 0.30,   // shallowest a hill's peak may reach (30% down from top)
        max: 0.80,   // deepest a pit's floor may reach (80% down from top)
        start: 0.55  // where terrain starts, roughly mid-screen
    },

    // How many world-pixels of terrain to pre-generate ahead of the
    // player at a time. Also doubles as the finish-line distance (the
    // spawn-to-worldWidth run length).
    worldWidth: 6000,

    // Relative weights for which "feature" a segment becomes. Bigger
    // number = more common. These are normalized automatically.
    featureWeights: {
        flat: 32,
        gentleUp: 18,
        gentleDown: 18,
        hill: 16,
        pit: 16
    },

    // THE key anti-spike control: max allowed slope (rise/run) between
    // any two consecutive control points. PROGRESSIVE — starts gentle
    // near spawn and ramps up toward the finish. Widened so the
    // previously-approved "end" difficulty (~0.7, ~35-37° observed)
    // now sits around the MIDDLE of the run instead of being the peak
    // — early sections get gentler, late sections get properly harder.
    maxSlopeStart: 0.2,  // ~11°, easy warm-up
    maxSlopeEnd: 1.05,   // ~46°, real late-game challenge

    // Same idea for hill/pit intensity — small bumps early, bigger
    // drops/climbs later. Scaled up on the end side to match the wider
    // slope range above.
    hillHeightRangeStart: [25, 60],
    hillHeightRangeEnd: [110, 230],
    pitDepthRangeStart: [20, 50],
    pitDepthRangeEnd: [100, 190],

    // Number of smoothing passes applied to the generated control
    // points (see smoothingStrength below for HOW MUCH each pass
    // smooths — together these give fine control over the terrain's
    // "edge").
    smoothingPasses: 1,

    // How strongly each smoothing pass blends toward the 3-point
    // average (0 = no smoothing at all, 1 = full average). Tuned by
    // measuring actual worst-case local slope across many seeds:
    //   0.0  -> 41.7° (spline overshoot at every hill peak — guaranteed crash)
    //   0.2  -> 36.8° (real spikes still happen, but not every single time)
    //   0.5  -> 28.2° (felt too tame)
    //   1.0  -> 29.7° (full smoothing, also too tame)
    // 0.2 landed as the sweet spot between "always crashes" and "too stable".
    smoothingStrength: 0.2,

    // Catmull-Rom "tension"-like smoothing sample density: how many
    // pixels apart we sample the spline when drawing/measuring terrain.
    // Smaller = smoother visuals, more expensive.
    sampleStep: 8,

    // Half-step (h) used for central-difference slope calculation:
    //   slope ≈ (terrainHeight(x+h) - terrainHeight(x-h)) / (2h)
    // Small enough to be a locally accurate tangent, large enough to
    // avoid floating-point noise. 2px works well for this curve's scale.
    slopeSampleH: 2,

    // ---- Phase 3: physics collision body settings ----
    // How far apart (world px) each static collision rectangle is along
    // the terrain. Coarser than sampleStep (used for drawing) on purpose
    // — collision doesn't need every visual wrinkle, and fewer physics
    // bodies means better mobile performance.
    physicsSegmentStep: 24,

    // Thickness (px) of each terrain collision rectangle, measured
    // perpendicular to the local slope. Needs to be thick enough that a
    // fast-falling car can't tunnel through in one physics step.
    physicsSegmentThickness: 60,

    // Coulomb friction coefficient for the ground surface itself. Higher
    // = more grip. Combines with the wheel's own friction when Matter
    // resolves a contact (Phase 4 needs decent grip for engine force to
    // actually move the car instead of just spinning the wheels).
    groundFriction: 0.9
};

// ---- Physics engine (Matter.js) -----------------------------------------
const PHYSICS_CONFIG = {
    // Matter's gravity is expressed as (direction, magnitude, scale).
    // We keep Matter's own default (y:1, scale:0.001) rather than
    // inventing our own — it's already tuned to look "right" at
    // pixel-scale body sizes, which is exactly what we're using.
    gravity: { x: 0, y: 1, scale: 0.001 },

    // Max delta (ms) passed to the physics step in one frame. If the
    // browser hiccups (tab backgrounded, slow frame), a huge delta would
    // make Matter apply a huge force in one jump — capping it prevents
    // that "physics explosion" and just makes time appear to slow down
    // briefly instead, which is far less jarring.
    maxDeltaMs: 33,

    // Collision accuracy iterations. Matter's defaults (6 position, 4
    // velocity) are fine for most games; we bump position iterations
    // slightly since a car resting on uneven, segmented terrain benefits
    // from more accurate contact resolution (less visible jitter/sinking).
    positionIterations: 8,
    velocityIterations: 4
};

// ---- Car (Phase 3: structure only — engineForce/brakeForce below are
// defined now for centralization per spec, but stay INERT until Phase 4
// actually applies them as forces) ----------------------------------------
const CAR_CONFIG = {
    // --- Chassis (car body) ---
    // Physical size of the rectangular chassis, in px.
    bodyWidth: 86,
    bodyHeight: 28,

    // mass: how much "stuff" the chassis has. Heavier = harder to
    // accelerate/decelerate (more inertia), and it presses into the
    // ground harder (more normal force -> more available friction/grip).
    bodyMass: 6,

    // Rotational inertia (a.k.a. moment of inertia): how much the
    // chassis "resists" being spun. Matter can compute this
    // automatically from the shape, but we override it explicitly here
    // because it's the single biggest knob for flip behavior — HIGHER
    // inertia means the car resists rotating (feels planted, harder to
    // flip), LOWER means it spins easily (feels twitchy, flips easily).
    // Matter's auto-derived value for this rectangle is roughly ~4000.
    // Raised back up close to that: now that the wheelie-style offset
    // force application point (see Car.applyEngineForce) is doing the
    // actual work of inducing flips under hard acceleration, the car
    // doesn't need to be globally twitchy/unstable too — that was
    // causing random flipping/spinning from ordinary bumps instead of
    // flips being a deliberate result of flooring it.
    bodyInertia: 3200,

    // Center of mass offset from the chassis's geometric center, in px.
    // {x:0, y:0} = perfectly centered. Pulled back close to centered —
    // same reasoning as bodyInertia above.
    centerOfMassOffset: { x: 0, y: -2 },

    // --- Wheels ---
    wheelRadius: 15,
    wheelMass: 1,

    // Coulomb friction: how much a wheel resists SLIDING once it's
    // already sliding against the ground. 1.0 is very grippy (rarely
    // slides once moving); lower values feel more like driving on ice.
    wheelFriction: 0.85,

    // Static friction threshold: how much force it takes to START a
    // wheel sliding from rest. Usually set a bit above wheelFriction —
    // real tires grip harder just before they break loose than while
    // already sliding.
    wheelFrictionStatic: 1.0,

    // How far forward/back each wheel sits from the chassis center, px.
    frontWheelOffsetX: 30,
    rearWheelOffsetX: -30,

    // How far below the chassis center each wheel sits, px (positive =
    // down, since canvas y grows downward).
    wheelOffsetY: 16,

    // --- Wheel-to-chassis connection (acts like a simple suspension) ---
    // stiffness: 1.0 = rigid rod (no give at all). Lower values behave
    // like a spring — the wheel can move closer/further from its rest
    // position under load, absorbing bumps instead of transmitting
    // every terrain wrinkle straight into the chassis. Pulled back to a
    // more absorbing/stable value — same reasoning as bodyInertia above.
    suspensionStiffness: 0.72,
    // damping: how quickly any spring oscillation settles down. Higher
    // = suspension stops bouncing sooner (feels stiffer/more damped).
    // Raised back up so ordinary terrain bumps settle out instead of
    // wobbling into an accidental flip.
    suspensionDamping: 0.16,

    // --- Driving forces (Phase 4: now actually wired up) ---
    // Which wheel(s) receive the accelerator's driving force. Switched
    // to rear-only: with force applied at the wheels (see
    // Car.applyEngineForce's offset point below), rear-wheel drive is
    // what actually produces a "wheelie" torque under hard acceleration
    // — 'both' was pushing symmetrically front and back, which mostly
    // just translates the car forward with much less rotational kick.
    drivenWheels: 'rear', // 'front' | 'rear' | 'both'

    // engineForce: how hard the engine can push the car forward per
    // frame while the accelerator is held. Raised again — still felt
    // weak even with the rear-wheel torque offset.
    engineForce: 0.013,

    // brakeForce: applied as a CONSTANT backward push every frame the
    // brake zone is held, regardless of current velocity sign (see
    // Car.applyBrakeForce). Matched to engineForce so accelerate/brake
    // feel like true mirror images of each other.
    brakeForce: 0.013,

    // How far below the wheel's center the engine force is applied, as
    // a fraction of wheelRadius (1.0 = full radius = exactly at ground
    // contact, 0.0 = dead center = zero torque, pure translation). 1.0
    // put so much of the force into rotational "wheelie" torque that
    // not enough was left over as actual forward thrust — the car
    // struggled to climb hills. Pulled to 0.5: still a real torque
    // effect for wheelies under hard acceleration, but with enough net
    // horizontal thrust to actually climb.
    engineForceContactOffsetRatio: 0.5
};

// ---- Camera (Phase 5) ----------------------------------------------------
const CAMERA_CONFIG = {
    // How far ahead of center the camera biases, as a fraction of the
    // viewport width. 0 = car dead-center (Phase 3/4's placeholder
    // behavior); higher = more upcoming terrain visible in front of the
    // car, less behind. This game always scrolls rightward, so "ahead"
    // simply means biased toward the right side of the screen.
    leadFactor: 0.32,

    // How quickly the camera catches up to its target position each
    // frame (0-1). Lower = smoother/laggier (cinematic drift), higher =
    // snappier/stiffer (feels more directly attached to the car).
    smoothing: 0.08
};

// ---- Coins (Phase 5) -------------------------------------------------------
const COIN_CONFIG = {
    radius: 11,
    value: 10, // score points per coin

    // Horizontal spacing between coins, randomized within this range.
    spacingMin: 160,
    spacingMax: 380,

    // How far above the terrain surface each coin floats, px. Needs to
    // be low enough that a car driving along the surface actually
    // passes through it (this is a ground vehicle, it can't jump to
    // reach a coin floating too high).
    heightAboveGround: 34,

    // Coins are skipped on any spot where the local terrain slope is
    // steeper than this — keeps them off the steepest hill/pit faces so
    // every coin is realistically visible and reachable while driving,
    // rather than floating awkwardly over a near-cliff.
    maxSlopeForPlacement: 0.3,

    // How close the car needs to get (px, from coin center to nearest
    // car part) to collect it.
    pickupRadius: 30
};

// ---- Game-over conditions (Phase 5) ---------------------------------------
const GAMEOVER_CONFIG = {
    // A car is considered "flipped" once its chassis rotation is more
    // than this many degrees away from upright. Set well above the
    // steepest normal driving angle (terrain's own max is well under
    // this, see TERRAIN_CONFIG.maxSlopeEnd) so ordinary hill-climbing
    // never false-triggers this.
    flipAngleDegrees: 100,

    // Once flipped, the angle must drop back below THIS (much lower)
    // threshold before the flip timer resets. Without this gap, a
    // flipped car that's jittering/wobbling near the 100° line (very
    // possible with lower suspension damping) would flicker above and
    // below it, resetting the sustain timer every time and NEVER
    // actually triggering game over. This hysteresis gap means a brief
    // wobble back to, say, 90° doesn't count as "recovered" — only a
    // real recovery below 55° does.
    flipRecoverDegrees: 55,

    // The flip angle must be sustained for this long (ms) before it
    // actually ends the run — long enough that a quick bounce that
    // genuinely recovers isn't punished, short enough to actually
    // trigger reliably once the car is truly stuck upside-down.
    flipSustainMs: 700,

    // If the car's y-position ends up more than this many px below the
    // local terrain height, it's considered to have fallen through/off
    // the world (shouldn't normally happen given our collision setup,
    // but this is the safety-net failure condition the spec asks for).
    fallThresholdPx: 250
};

// ---- Save system (Phase 6) -------------------------------------------------
const SAVE_CONFIG = {
    // Namespaced so this doesn't collide with the main site's own
    // localStorage usage, and so future mini-games on the same site can
    // each get their own "ssonolGames:<gameName>" key without stepping
    // on each other or on this one.
    key: 'ssonolGames:footRacer:v1'
};

// ---- Rendering / visual language (adapted from the main site) ----------
// Colors are intentionally the *same palette family* as the main website
// (apple-green + cream + brown) so the game feels like the same product,
// but reassigned to game-specific roles (sky, terrain fill, etc).
const RENDER_CONFIG = {
    // Caps devicePixelRatio for canvas rendering. Some phones report 3
    // (or higher) — rendering every pixel at 3x resolution every frame
    // is real GPU/CPU cost for very little visible sharpness gain over
    // 2x on a game canvas. This is one of the more impactful mobile
    // perf wins available without touching gameplay code at all.
    maxDevicePixelRatio: 2,

    sky: {
        // 풋사과(green apple) feel — vivid, saturated apple-green up
        // top fading to a pale yellow-green near the horizon. The
        // earlier blue sky fixed the "dull" problem but lost the
        // site's actual green-apple identity; this keeps the vibrance
        // while staying on-brand.
        top: '#C8FF6E',
        bottom: '#F3FFD9'
    },
    terrain: {
        // Kept distinct from the now-green sky (see sky.top above) so
        // the horizon line still reads clearly — a touch deeper/more
        // saturated than the sky's green.
        fillTop: '#7ED320',
        fillBottom: '#2E5C00',
        outline: '#2E5C00',
        outlineWidth: 4
    },
    // Simple parallax-ready ground texture accent (small dashes along
    // the surface), purely decorative, mirrors the site's playful dot
    // background pattern.
    surfaceDashColor: 'rgba(255,255,255,0.35)',

    // Simple px-to-meters ratio, purely for a friendly distance readout
    // in the HUD/game-over screen (e.g. "240m") rather than raw pixels.
    pxPerMeter: 8
};
