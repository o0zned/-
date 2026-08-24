/**
 * camera.js
 * -----------------------------------------------------------------------
 * Phase 5's real camera, replacing the bare center-follow placeholder
 * from Phase 3/4. Two things a "just center on the car" camera doesn't
 * do, which this does:
 *
 *   1. LEAD SPACE — biases toward showing more terrain ahead of the car
 *      than behind it, so upcoming hills/pits/coins are visible with
 *      enough warning to react.
 *   2. SMOOTHING — eases toward its target position each frame instead
 *      of snapping instantly, which reads as "camera operator following
 *      a car" instead of "car glued to the middle of the screen".
 * -----------------------------------------------------------------------
 */

class Camera {
    constructor(worldWidth) {
        this.x = 0;
        this.worldWidth = worldWidth;
    }

    setWorldWidth(worldWidth) {
        this.worldWidth = worldWidth;
    }

    /** Snaps the camera immediately to center on a point, no smoothing.
     * Used right after spawning/respawning so the camera doesn't drift
     * in from wherever it happened to be. */
    snapTo(carX, viewW) {
        const lead = CAMERA_CONFIG.leadFactor * viewW;
        this.x = this._clamp(carX - viewW / 2 + lead, viewW);
    }

    update(carX, viewW) {
        const lead = CAMERA_CONFIG.leadFactor * viewW;
        const targetX = this._clamp(carX - viewW / 2 + lead, viewW);
        this.x += (targetX - this.x) * CAMERA_CONFIG.smoothing;
    }

    _clamp(x, viewW) {
        return Math.max(0, Math.min(x, Math.max(0, this.worldWidth - viewW)));
    }
}
