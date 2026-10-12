class Camera {
    constructor(worldWidth) {
        this.x = 0;
        this.worldWidth = worldWidth;
    }

    setWorldWidth(worldWidth) {
        this.worldWidth = worldWidth;
    }

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
