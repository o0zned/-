/**
 * debug.js
 * -----------------------------------------------------------------------
 * Debug overlay reporting exactly the numbers the physics system needs:
 *
 *   - position     (world x)
 *   - terrain slope   (dy/dx via central difference, see terrain.js)
 *   - theta           (atan(slope), radians — shown in degrees)
 *   - velocity        (px/s)
 *   - acceleration    (px/s²)
 *
 * Phase 2 had no car, so this tracked a fake "probe" and derived
 * velocity/acceleration purely from finite differences of its position.
 * Phase 3 adds a real Matter.js car body — when the caller passes an
 * `externalSpeed` (the chassis's actual physics speed, converted to
 * px/s by game.js), we use THAT for velocity instead of re-deriving it,
 * since the physics engine's own number is more accurate than our
 * finite-difference guess. Acceleration is still finite-differenced
 * from velocity each frame, since Matter doesn't expose acceleration
 * directly.
 * -----------------------------------------------------------------------
 */

const Debug = {
    enabled: false,

    // Fallback for browsers without native ctx.roundRect (older mobile
    // Safari/WebViews). No-op if the native method already exists.
    _ensureRoundRect(ctx) {
        if (typeof ctx.roundRect === 'function') return;
        ctx.roundRect = function (x, y, w, h, r) {
            this.beginPath();
            this.moveTo(x + r, y);
            this.arcTo(x + w, y, x + w, y + h, r);
            this.arcTo(x + w, y + h, x, y + h, r);
            this.arcTo(x, y + h, x, y, r);
            this.arcTo(x, y, x + w, y, r);
            this.closePath();
        };
    },

    // Internal tracking state for finite-difference velocity/accel.
    _lastX: null,
    _lastVelocity: 0,
    _lastTimestamp: null,

    // Smoothing factor for the exponential moving average applied to
    // velocity/acceleration, purely so the on-screen numbers don't jitter
    // wildly frame-to-frame (dragging your finger is not a smooth input).
    _smoothing: 0.15,

    toggle() {
        this.enabled = !this.enabled;
        // Reset tracking so toggling off/on doesn't produce a fake spike.
        this._lastX = null;
        this._lastVelocity = 0;
        this._lastTimestamp = null;
    },

    /**
     * Call once per frame with the tracked point's current world
     * x-position. If externalSpeed (px/s) is provided — the real
     * Matter.js car speed — it's used directly instead of being
     * re-derived by finite difference. carAngleDeg, if provided, is
     * shown alongside terrain theta for a quick visual sanity check of
     * whether the car is sitting flush with the slope.
     */
    update(terrain, probeX, timestampMs, externalSpeed = null, carAngleDeg = null) {
        const height = terrain.getHeightAt(probeX);
        const slope = terrain.getSlopeAt(probeX);
        const theta = terrain.getThetaAt(probeX);

        let velocity;
        if (externalSpeed !== null) {
            velocity = externalSpeed;
        } else {
            velocity = 0;
            if (this._lastX !== null && this._lastTimestamp !== null) {
                const dt = (timestampMs - this._lastTimestamp) / 1000; // seconds
                if (dt > 0) {
                    const rawVelocity = (probeX - this._lastX) / dt;
                    velocity = this._lastVelocity + (rawVelocity - this._lastVelocity) * this._smoothing;
                }
            }
        }
        const acceleration = this._lastTimestamp !== null
            ? (velocity - this._lastVelocity) / Math.max(0.001, (timestampMs - this._lastTimestamp) / 1000)
            : 0;

        this._lastX = probeX;
        this._lastVelocity = velocity;
        this._lastTimestamp = timestampMs;

        return {
            position: probeX,
            height,
            slope,
            theta,
            thetaDegrees: theta * (180 / Math.PI),
            velocity,
            acceleration,
            carAngleDeg
        };
    },

    /**
     * Draws the debug text panel + a visual tangent-line marker showing
     * the slope angle right on the terrain, at the probe's screen position.
     */
    render(ctx, snapshot, probeScreenX) {
        if (!this.enabled) return;

        // --- Tangent line + marker on the terrain itself ---------------
        const len = 40;
        const dx = Math.cos(snapshot.theta) * len;
        const dy = Math.sin(snapshot.theta) * len;
        ctx.save();
        ctx.strokeStyle = '#E85D75';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(probeScreenX - dx, snapshot.height - dy);
        ctx.lineTo(probeScreenX + dx, snapshot.height + dy);
        ctx.stroke();

        ctx.fillStyle = '#E85D75';
        ctx.beginPath();
        ctx.arc(probeScreenX, snapshot.height, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();

        // --- Text panel ---------------------------------------------------
        const lines = [
            `x: ${snapshot.position.toFixed(0)}px   h: ${snapshot.height.toFixed(1)}px`,
            `slope: ${snapshot.slope.toFixed(3)}   theta: ${snapshot.thetaDegrees.toFixed(1)}°`,
            `velocity: ${snapshot.velocity.toFixed(1)} px/s`,
            `accel: ${snapshot.acceleration.toFixed(1)} px/s²`
        ];
        if (snapshot.carAngleDeg !== null) {
            lines.push(`car angle: ${snapshot.carAngleDeg.toFixed(1)}° (terrain: ${snapshot.thetaDegrees.toFixed(1)}°)`);
        }

        const paddingX = 10, paddingY = 8, lineHeight = 16;
        const boxW = 210, boxH = paddingY * 2 + lineHeight * lines.length;
        const boxX = 10, boxY = ctx.canvas.clientHeight - boxH - 10;

        ctx.save();
        this._ensureRoundRect(ctx);
        ctx.fillStyle = 'rgba(74,55,40,0.85)'; // --brown, translucent
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();

        ctx.fillStyle = '#BFF366'; // --green, readable on dark brown
        ctx.font = '12px monospace';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            ctx.fillText(line, boxX + paddingX, boxY + paddingY + i * lineHeight);
        });
        ctx.restore();
    }
};
