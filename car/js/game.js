(function () {
    if (typeof Matter === 'undefined') return;
    const canvas = document.getElementById('game-canvas');
    const ctx = canvas.getContext('2d');
    const SPAWN_X = 150;

    function tryLockLandscape() {
        if (screen.orientation && screen.orientation.lock) {
            screen.orientation.lock('landscape').catch(() => {});
        }
    }
    window.addEventListener('touchstart', tryLockLandscape, { once: true });
    window.addEventListener('mousedown', tryLockLandscape, { once: true });

    let audioCtx = null;
    function unlockAudio() {
        if (!audioCtx) {
            try {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            } catch (e) {}
        }
        if (audioCtx && audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
    }
    window.addEventListener('touchstart', unlockAudio, { once: true });
    window.addEventListener('mousedown', unlockAudio, { once: true });
    function playCoinSound() {
        if (!audioCtx) return;

        if (audioCtx.state === 'suspended') {
            audioCtx.resume().catch(() => {});
        }
        const o = audioCtx.createOscillator();
        const g = audioCtx.createGain();
        o.connect(g); g.connect(audioCtx.destination);
        o.frequency.value = 880;
        g.gain.setValueAtTime(0.15, audioCtx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.15);
        o.start();
        o.stop(audioCtx.currentTime + 0.15);
    }

    let terrain = null;
    let car = null;
    let camera = null;
    let coins = null;
    let cameraX = 0;

    let gameOver = false;
    let gameOverReason = null;
    let flipStartTime = null;

    function clamp(v, min, max) { return Math.max(min, Math.min(max, v)); }

    function normalizedAngleDegrees(radians) {
        const twoPi = Math.PI * 2;
        let a = ((radians + Math.PI) % twoPi + twoPi) % twoPi - Math.PI;
        return a * (180 / Math.PI);
    }

    function spawnCar(seed) {
        if (car) car.destroy(Physics.world);
        const spawnY = terrain.getHeightAt(SPAWN_X) - 150;
        car = new Car(Physics.world, SPAWN_X, spawnY);
        coins = new Coins(terrain, seed);
        gameOver = false;
        gameOverReason = null;
        flipStartTime = null;
        hideGameOverOverlay();
        updateHud();
        if (camera) camera.snapTo(car.position.x, canvas.clientWidth);
    }

    let currentSeed = Math.floor(Math.random() * 1000000) + 1;
    function resizeCanvas() {

        const dpr = Math.min(window.devicePixelRatio || 1, RENDER_CONFIG.maxDevicePixelRatio);
        const rect = canvas.parentElement.getBoundingClientRect();
        canvas.width = Math.round(rect.width * dpr);
        canvas.height = Math.round(rect.height * dpr);
        canvas.style.width = rect.width + 'px';
        canvas.style.height = rect.height + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
        cachedGradientViewH = null;

        let terrainChanged = false;
        if (!terrain) {
            terrain = new Terrain(currentSeed, rect.height);
            terrainChanged = true;
        } else {
            const prevHeight = terrain.viewportHeight;
            terrain.onViewportResize(rect.height);
            terrainChanged = Math.abs(rect.height - prevHeight) >= 2;
        }
        if (!camera) camera = new Camera(TERRAIN_CONFIG.worldWidth);

        if (terrainChanged && Physics.engine) {
            Physics.buildTerrainCollision(terrain);
            spawnCar(currentSeed);
        }
    }
    window.addEventListener('resize', resizeCanvas);
    window.addEventListener('orientationchange', resizeCanvas);

    let cachedGradientViewH = null;
    let skyGradient = null;
    let terrainGradient = null;
    function ensureGradients(viewH) {
        if (viewH === cachedGradientViewH) return;
        skyGradient = ctx.createLinearGradient(0, 0, 0, viewH);
        skyGradient.addColorStop(0, RENDER_CONFIG.sky.top);
        skyGradient.addColorStop(1, RENDER_CONFIG.sky.bottom);

        terrainGradient = ctx.createLinearGradient(0, 0, 0, viewH);
        terrainGradient.addColorStop(0, RENDER_CONFIG.terrain.fillTop);
        terrainGradient.addColorStop(1, RENDER_CONFIG.terrain.fillBottom);

        cachedGradientViewH = viewH;
    }

    function drawSky(viewW, viewH) {
        ctx.fillStyle = skyGradient;
        ctx.fillRect(0, 0, viewW, viewH);

        const appleX = viewW * 0.8;
        const appleY = viewH * 0.15;
        ctx.save();
        ctx.globalAlpha = 0.9;
        ctx.font = '34px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🍏', appleX, appleY);
        ctx.restore();

        const t = cloudTimeMs / 20000;
        drawCloud(viewW * ((t * 0.3) % 1.4) - 80, viewH * 0.18, 1.0);
        drawCloud(viewW * ((t * 0.3 + 0.6) % 1.4) - 80, viewH * 0.3, 0.7);
    }

    function drawCloud(x, y, scale) {
        ctx.save();
        ctx.globalAlpha = 0.55;
        ctx.fillStyle = '#FFFFFF';
        ctx.beginPath();
        ctx.ellipse(x, y, 26 * scale, 14 * scale, 0, 0, Math.PI * 2);
        ctx.ellipse(x + 20 * scale, y - 6 * scale, 18 * scale, 12 * scale, 0, 0, Math.PI * 2);
        ctx.ellipse(x - 20 * scale, y + 2 * scale, 16 * scale, 10 * scale, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawTerrain(viewW, viewH) {
        const step = TERRAIN_CONFIG.sampleStep;
        const startX = cameraX - 20;
        const endX = cameraX + viewW + 20;

        ctx.beginPath();
        ctx.moveTo(startX - cameraX, viewH);
        for (let x = startX; x <= endX; x += step) {
            ctx.lineTo(x - cameraX, terrain.getHeightAt(x));
        }
        ctx.lineTo(endX - cameraX, viewH);
        ctx.closePath();
        ctx.fillStyle = terrainGradient;
        ctx.fill();

        ctx.beginPath();
        let first = true;
        let dashCounter = 0;
        ctx.fillStyle = RENDER_CONFIG.surfaceDashColor;
        for (let x = startX; x <= endX; x += step) {
            const sx = x - cameraX;
            const sy = terrain.getHeightAt(x);
            if (first) { ctx.moveTo(sx, sy); first = false; }
            else ctx.lineTo(sx, sy);

            if (dashCounter % 6 === 0) ctx.fillRect(sx - 2, sy + 6, 10, 3);
            dashCounter++;
        }
        ctx.strokeStyle = RENDER_CONFIG.terrain.outline;
        ctx.lineWidth = RENDER_CONFIG.terrain.outlineWidth;
        ctx.lineJoin = 'round';
        ctx.stroke();
    }

    function drawControlZoneFeedback(viewW, viewH) {
        if (Input.brake) {
            ctx.fillStyle = 'rgba(232,93,117,0.12)';
            ctx.fillRect(0, 0, viewW / 2, viewH);
        }
        if (Input.accelerate) {
            ctx.fillStyle = 'rgba(191,243,102,0.18)';
            ctx.fillRect(viewW / 2, 0, viewW / 2, viewH);
        }
    }

    const hudCoinsEl = document.getElementById('hud-coins');
    const hudDistanceEl = document.getElementById('hud-distance');
    function updateHud() {
        hudCoinsEl.textContent = coins ? coins.collectedCount : 0;
        const distM = car ? Math.max(0, Math.round((car.position.x - SPAWN_X) / RENDER_CONFIG.pxPerMeter)) : 0;
        hudDistanceEl.textContent = distM + 'm';
    }
    function pulseCoinsHud() {
        hudCoinsEl.parentElement.classList.remove('pulse');
        void hudCoinsEl.parentElement.offsetWidth;
        hudCoinsEl.parentElement.classList.add('pulse');
    }

    const overlayEl = document.getElementById('gameover-overlay');
    const overlayEmojiEl = document.getElementById('gameover-emoji');
    const overlayTitleEl = document.getElementById('gameover-title');
    const overlaySubEl = document.getElementById('gameover-sub');
    const statScoreEl = document.getElementById('stat-score');
    const statCoinsEl = document.getElementById('stat-coins');
    const statDistanceEl = document.getElementById('stat-distance');
    const statBestScoreEl = document.getElementById('stat-best-score');
    const statBestDistanceEl = document.getElementById('stat-best-distance');

    function showGameOverOverlay(reason) {
        const distM = Math.max(0, Math.round((car.position.x - SPAWN_X) / RENDER_CONFIG.pxPerMeter));
        const presets = {
            finished: { emoji: '🏁', title: '완주!', sub: '끝까지 잘 달렸어요!' },
            flipped: { emoji: '🙃', title: '뒤집혔어요!', sub: '차가 뒤집혀서 더 이상 달릴 수 없어요.' },
            fell: { emoji: '💥', title: '추락!', sub: '차가 지형 밖으로 떨어졌어요.' }
        };
        const p = presets[reason] || presets.fell;
        overlayEmojiEl.textContent = p.emoji;
        overlayTitleEl.textContent = p.title;
        overlaySubEl.textContent = p.sub;
        statScoreEl.textContent = coins.score;
        statCoinsEl.textContent = coins.collectedCount + ' / ' + coins.list.length;
        statDistanceEl.textContent = distM + 'm';

        const saved = SaveSystem.recordRun({
            score: coins.score,
            coins: coins.collectedCount,
            distance: distM,
            completed: reason === 'finished'
        });
        statBestScoreEl.textContent = saved.bestScore;
        statBestDistanceEl.textContent = saved.bestDistance + 'm';

        const homeLinkEl = document.getElementById('home-link');
        homeLinkEl.href = (reason === 'finished') ? '/?piece=1' : '/';

        overlayEl.classList.add('show');
    }
    function hideGameOverOverlay() {
        overlayEl.classList.remove('show');
    }
    document.getElementById('restart-btn').addEventListener('click', () => {
        spawnCar(currentSeed);
    });

    let lastTimestamp = null;
    let cloudTimeMs = 0;

    let renderErrorLogged = false;
    function render(timestampMs) {
        requestAnimationFrame(render);
        try {
            renderFrame(timestampMs);
        } catch (e) {
            if (!renderErrorLogged) { console.error('[car] frame error', e); renderErrorLogged = true; }
        }
    }

    function renderFrame(timestampMs) {
        const viewW = canvas.clientWidth;
        const viewH = canvas.clientHeight;

        const dt = lastTimestamp !== null ? (timestampMs - lastTimestamp) : 1000 / 60;
        lastTimestamp = timestampMs;
        cloudTimeMs += dt;

        ensureGradients(viewH);

        if (!gameOver) {

            if (Input.accelerate) car.applyEngineForce();
            if (Input.brake) car.applyBrakeForce();
            Physics.step(dt);

            const newly = coins.checkCollisions(car);
            if (newly > 0) {
                updateHud();
                pulseCoinsHud();
                playCoinSound();
            }

            const angleDeg = Math.abs(normalizedAngleDegrees(car.angle));
            if (flipStartTime === null) {

                if (angleDeg > GAMEOVER_CONFIG.flipAngleDegrees) {
                    flipStartTime = timestampMs;
                }
            } else {

                if (angleDeg < GAMEOVER_CONFIG.flipRecoverDegrees) {
                    flipStartTime = null;
                } else if (timestampMs - flipStartTime > GAMEOVER_CONFIG.flipSustainMs) {
                    gameOver = true;
                    gameOverReason = 'flipped';
                }
            }

            const groundY = terrain.getHeightAt(car.position.x);
            if (car.position.y - groundY > GAMEOVER_CONFIG.fallThresholdPx) {
                gameOver = true;
                gameOverReason = 'fell';
            }

            if (car.position.x >= TERRAIN_CONFIG.worldWidth - 50) {
                gameOver = true;
                gameOverReason = 'finished';
            }

            if (gameOver) showGameOverOverlay(gameOverReason);

            camera.update(car.position.x, viewW);
            cameraX = camera.x;

            updateHud();
        }

        ctx.clearRect(0, 0, viewW, viewH);
        drawSky(viewW, viewH);
        drawTerrain(viewW, viewH);
        coins.render(ctx, cameraX, viewW, timestampMs);
        if (!gameOver) drawControlZoneFeedback(viewW, viewH);
        car.render(ctx, cameraX);

        const lastDelta = Physics.engine.timing.lastDelta || dt;
        const speedPxPerSec = Math.hypot(car.velocity.x, car.velocity.y) * (1000 / Math.max(1, lastDelta));
        const carAngleDeg = car.angle * (180 / Math.PI);
        const snapshot = Debug.update(terrain, car.position.x, timestampMs, speedPxPerSec, carAngleDeg);
        Debug.render(ctx, snapshot, car.position.x - cameraX);
    }

    UI.init((newSeed) => {
        currentSeed = newSeed;
        terrain.regenerate(newSeed);
        Physics.buildTerrainCollision(terrain);
        spawnCar(newSeed);
    });
    UI.setSeedLabel(currentSeed);
    document.getElementById('seed-input').value = currentSeed;

    const debugBtn = document.getElementById('debug-btn');
    debugBtn.addEventListener('click', () => {
        Debug.toggle();
        debugBtn.classList.toggle('active', Debug.enabled);
        document.body.classList.toggle('debug-active', Debug.enabled);
    });

    Physics.init();
    Input.init(canvas);
    resizeCanvas();
    requestAnimationFrame(render);
})();
