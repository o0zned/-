const TERRAIN_CONFIG = {

    minSegmentWidth: 110,
    maxSegmentWidth: 220,

    heightRatio: {
        min: 0.30,
        max: 0.80,
        start: 0.55
    },

    worldWidth: 6000,

    featureWeights: {
        flat: 32,
        gentleUp: 18,
        gentleDown: 18,
        hill: 16,
        pit: 16
    },

    maxSlopeStart: 0.2,
    maxSlopeEnd: 1.05,

    hillHeightRangeStart: [25, 60],
    hillHeightRangeEnd: [110, 230],
    pitDepthRangeStart: [20, 50],
    pitDepthRangeEnd: [100, 190],

    smoothingPasses: 1,

    smoothingStrength: 0.2,

    sampleStep: 8,

    slopeSampleH: 2,

    physicsSegmentStep: 24,

    physicsSegmentThickness: 60,

    groundFriction: 0.9
};

const PHYSICS_CONFIG = {

    gravity: { x: 0, y: 1, scale: 0.001 },

    maxDeltaMs: 33,

    positionIterations: 8,
    velocityIterations: 4
};

const CAR_CONFIG = {

    visualBodyScale: 1.5,
    visualWheelScale: 0.4,
    visualBodyOffsetY: -3,

    bodyWidth: 86,
    bodyHeight: 28,

    bodyMass: 4,

    bodyInertia: 1900,

    centerOfMassOffset: { x: 0, y: -8 },

    wheelRadius: 15,
    wheelMass: 1,

    wheelFriction: 0.85,

    wheelFrictionStatic: 1.0,

    frontWheelOffsetX: 30,
    rearWheelOffsetX: -30,

    wheelOffsetY: 16,

    suspensionStiffness: 0.9,

    suspensionDamping: 0.06,

    drivenWheels: 'rear',

    engineForce: 0.012,

    brakeForce: 0.012,

    engineForceContactOffsetRatio: 0.5
};

const CAMERA_CONFIG = {

    leadFactor: 0.32,

    smoothing: 0.08
};

const COIN_CONFIG = {
    radius: 11,
    value: 10,

    spacingMin: 160,
    spacingMax: 380,

    heightAboveGround: 34,

    maxSlopeForPlacement: 0.3,

    pickupRadius: 30
};

const GAMEOVER_CONFIG = {

    flipAngleDegrees: 100,

    flipRecoverDegrees: 55,

    flipSustainMs: 700,

    fallThresholdPx: 250
};

const SAVE_CONFIG = {

    key: 'ssonolGames:footRacer:v1'
};

const RENDER_CONFIG = {

    maxDevicePixelRatio: 2,

    sky: {

        top: '#C8FF6E',
        bottom: '#F3FFD9'
    },
    terrain: {

        fillTop: '#7ED320',
        fillBottom: '#2E5C00',
        outline: '#2E5C00',
        outlineWidth: 4
    },

    surfaceDashColor: 'rgba(255,255,255,0.35)',

    pxPerMeter: 8
};
