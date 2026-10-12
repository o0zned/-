const Debug = {
    enabled: false,

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

    _lastX: null,
    _lastVelocity: 0,
    _lastTimestamp: null,

    _smoothing: 0.15,

    toggle() {
        this.enabled = !this.enabled;

        this._lastX = null;
        this._lastVelocity = 0;
        this._lastTimestamp = null;
    },

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
                const dt = (timestampMs - this._lastTimestamp) / 1000;
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

    render(ctx, snapshot, probeScreenX) {
        if (!this.enabled) return;

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
        ctx.fillStyle = 'rgba(74,55,40,0.85)';
        ctx.beginPath();
        ctx.roundRect(boxX, boxY, boxW, boxH, 10);
        ctx.fill();

        ctx.fillStyle = '#BFF366';
        ctx.font = '12px monospace';
        ctx.textBaseline = 'top';
        lines.forEach((line, i) => {
            ctx.fillText(line, boxX + paddingX, boxY + paddingY + i * lineHeight);
        });
        ctx.restore();
    }
};
