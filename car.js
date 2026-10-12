/**
 * car.js
 * -----------------------------------------------------------------------
 * Phase 3: the car's physical STRUCTURE only — a chassis rectangle, two
 * wheel circles, and constraints holding them together. No engine force,
 * no brakes yet (Phase 4). Whatever motion you see right now is 100%
 * Matter's own gravity + collision response — which is exactly the
 * point of this phase: prove the physical setup is solid before any
 * player input touches it.
 * -----------------------------------------------------------------------
 */

const wheelImg = new Image();
let wheelImgReady = false;
wheelImg.onload = () => { wheelImgReady = true; };
wheelImg.src = '/assets/car/wheel.png';

// 차체 이미지 — 친구가 그려서 /assets/car/body.png로 올리면 자동으로 적용됨.
// 아직 파일이 없거나 로딩 전이면 onerror로 걸러서 기존 placeholder(크림색
// 둥근 사각형)가 그대로 나옴. 물리(섀시 크기/질량)는 전혀 안 건드림.
//
// 그림은 물리 박스(86x28) 크기에 억지로 꽉 채워 늘리지 않고, 원본
// 비율을 그대로 유지한 채 가로폭만 bodyWidth에 맞추고 높이는 비율대로
// 자동 계산해서 그림 — 그래서 친구가 어떤 비율로 그려오든 찌부러지지
// 않음. 세로로 더 긴 그림이면 물리 박스보다 위아래로 살짝 더 크게
// 보이는 것뿐이고, 충돌 판정(물리)에는 영향 없음.
const bodyImg = new Image();
let bodyImgReady = false;
let bodyImgAspect = 1; // naturalHeight / naturalWidth
bodyImg.onload = () => {
    bodyImgAspect = bodyImg.naturalHeight / bodyImg.naturalWidth;
    bodyImgReady = true;
};
bodyImg.onerror = () => { bodyImgReady = false; };
bodyImg.src = '/assets/car/body.png';

class Car {
    constructor(world, x, y) {
        const cfg = CAR_CONFIG;

        // --- Chassis ---
        this.chassis = Matter.Bodies.rectangle(x, y, cfg.bodyWidth, cfg.bodyHeight, {
            friction: 0.3,
            // Back to 0.02 — lowering this to chase more speed wasn't
            // actually what was asked for, and made drag feel too weak.
            frictionAir: 0.02,
            collisionFilter: { group: Physics.carCollisionGroup },
            label: 'chassis'
        });
        Matter.Body.setMass(this.chassis, cfg.bodyMass);
        if (cfg.bodyInertia !== null) {
            Matter.Body.setInertia(this.chassis, cfg.bodyInertia);
        }
        if (cfg.centerOfMassOffset.x !== 0 || cfg.centerOfMassOffset.y !== 0) {
            Matter.Body.setCentre(this.chassis, cfg.centerOfMassOffset, true);
        }

        // --- Wheels ---
        const wheelY = y + cfg.wheelOffsetY;
        this.frontWheel = Matter.Bodies.circle(x + cfg.frontWheelOffsetX, wheelY, cfg.wheelRadius, {
            friction: cfg.wheelFriction,
            frictionStatic: cfg.wheelFrictionStatic,
            collisionFilter: { group: Physics.carCollisionGroup },
            label: 'wheel'
        });
        Matter.Body.setMass(this.frontWheel, cfg.wheelMass);

        this.rearWheel = Matter.Bodies.circle(x + cfg.rearWheelOffsetX, wheelY, cfg.wheelRadius, {
            friction: cfg.wheelFriction,
            frictionStatic: cfg.wheelFrictionStatic,
            collisionFilter: { group: Physics.carCollisionGroup },
            label: 'wheel'
        });
        Matter.Body.setMass(this.rearWheel, cfg.wheelMass);

        // --- Suspension constraints: each wheel is tied to a fixed
        // attachment point on the chassis (in the chassis's LOCAL frame,
        // via pointA) rather than rigidly welded, so it can absorb bumps
        // like a simple spring instead of transmitting every terrain
        // wrinkle straight into the chassis rotation.
        this.frontConstraint = Matter.Constraint.create({
            bodyA: this.chassis,
            pointA: { x: cfg.frontWheelOffsetX, y: cfg.wheelOffsetY },
            bodyB: this.frontWheel,
            stiffness: cfg.suspensionStiffness,
            damping: cfg.suspensionDamping,
            length: 0
        });
        this.rearConstraint = Matter.Constraint.create({
            bodyA: this.chassis,
            pointA: { x: cfg.rearWheelOffsetX, y: cfg.wheelOffsetY },
            bodyB: this.rearWheel,
            stiffness: cfg.suspensionStiffness,
            damping: cfg.suspensionDamping,
            length: 0
        });

        Matter.Composite.add(world, [
            this.chassis, this.frontWheel, this.rearWheel,
            this.frontConstraint, this.rearConstraint
        ]);
    }

    get position() { return this.chassis.position; }
    get angle() { return this.chassis.angle; }
    get velocity() { return this.chassis.velocity; }
    get angularVelocity() { return this.chassis.angularVelocity; }

    /**
     * Applies driving force to the configured driven wheel(s), every
     * frame this is called — NOT a one-time velocity change. Called
     * continuously while the accelerator zone is held, so speed builds
     * up gradually via F=ma over many physics steps, per spec.
     *
     * Applied partway toward the wheel's ground contact point (see
     * CAR_CONFIG.engineForceContactOffsetRatio) rather than dead center.
     * Force at the exact center produces zero torque on a circle — pure
     * translation, no spin, no wheelie potential. Too much offset (all
     * the way to the contact point) sinks too much of the force into
     * rotation and leaves too little net forward thrust to climb hills.
     * The partial offset balances both.
     */
    applyEngineForce() {
        const cfg = CAR_CONFIG;
        const wheels = this._drivenWheels();
        for (const wheel of wheels) {
            const contactPoint = {
                x: wheel.position.x,
                y: wheel.position.y + cfg.wheelRadius * cfg.engineForceContactOffsetRatio
            };
            Matter.Body.applyForce(wheel, contactPoint, { x: cfg.engineForce, y: 0 });
        }
    }

    /**
     * Applies a constant backward force at each wheel, every frame this
     * is held — NOT conditional on current velocity. This is what makes
     * it double as reverse: while the car is moving forward, this force
     * decelerates it; once velocity crosses zero, the same force keeps
     * pushing and the car naturally drives backward, just like holding
     * a brake/reverse pedal in an arcade driving game.
     */
    applyBrakeForce() {
        const cfg = CAR_CONFIG;
        const wheels = [this.frontWheel, this.rearWheel]; // brakes act on all wheels regardless of drivenWheels
        for (const wheel of wheels) {
            Matter.Body.applyForce(wheel, wheel.position, { x: -cfg.brakeForce, y: 0 });
        }
    }

    _drivenWheels() {
        switch (CAR_CONFIG.drivenWheels) {
            case 'front': return [this.frontWheel];
            case 'rear': return [this.rearWheel];
            default: return [this.frontWheel, this.rearWheel];
        }
    }

    /** Draws the chassis + both wheels at their current physics pose. */
    render(ctx, cameraX) {
        this._renderWheel(ctx, this.rearWheel, cameraX);
        this._renderWheel(ctx, this.frontWheel, cameraX);
        this._renderChassis(ctx, cameraX);
    }

    _renderChassis(ctx, cameraX) {
        const cfg = CAR_CONFIG;
        const p = this.chassis.position;
        // 보이는 크기만 배율 적용 (충돌 상자 cfg.bodyWidth x bodyHeight는 그대로)
        const k = cfg.visualBodyScale || 1;
        const w = cfg.bodyWidth * k, h = cfg.bodyHeight * k;

        ctx.save();
        ctx.translate(p.x - cameraX, p.y);
        ctx.rotate(this.chassis.angle);
        ctx.translate(0, cfg.visualBodyOffsetY || 0);

        if (bodyImgReady && bodyImg.naturalWidth) {
            // 실제 차체 아트 — 가로폭은 물리 박스(w)에 맞추고, 높이는 원본
            // 비율대로 자동 계산해서 찌부러지지 않게 그림. 중앙 기준.
            const drawH = w * bodyImgAspect;
            ctx.drawImage(bodyImg, -w / 2, -drawH / 2, w, drawH);
        } else {
            // 친구가 그린 body.png가 아직 없거나 로딩 전 — placeholder.
            if (typeof ctx.roundRect !== 'function') {
                ctx.roundRect = function (x, y, w, h, r) {
                    this.beginPath();
                    this.moveTo(x + r, y);
                    this.arcTo(x + w, y, x + w, y + h, r);
                    this.arcTo(x + w, y + h, x, y + h, r);
                    this.arcTo(x, y + h, x, y, r);
                    this.arcTo(x, y, x + w, y, r);
                    this.closePath();
                };
            }
            ctx.fillStyle = '#FAFFF0';   // --cream
            ctx.strokeStyle = '#3D6B00'; // --green-deep
            ctx.lineWidth = 3;
            const r = 6;
            ctx.beginPath();
            ctx.roundRect(-w / 2, -h / 2, w, h, r);
            ctx.fill();
            ctx.stroke();
        }
        ctx.restore();
    }

    _renderWheel(ctx, wheel, cameraX) {
        const p = wheel.position;
        ctx.save();
        // 보이는 바퀴만 작게 그리되, 바닥에 닿는 높이는 실제 충돌 바퀴와 맞춤.
        // (아래로 내리는 이동은 회전보다 '먼저' 해야 함 — 회전 뒤에 하면 바퀴가
        // 구를 때 중심이 빙글빙글 돌아서 출렁거려 보임)
        const vk = CAR_CONFIG.visualWheelScale || 1;
        const vr = CAR_CONFIG.wheelRadius * vk;
        const d = vr * 2;
        ctx.translate(p.x - cameraX, p.y + (CAR_CONFIG.wheelRadius - vr));
        ctx.rotate(wheel.angle);
        if (wheelImgReady && wheelImg.naturalWidth) {
            // Real tire art — its own tread pattern reads the spin, so no
            // extra spoke line is drawn on top.
            ctx.drawImage(wheelImg, -d / 2, -d / 2, d, d);
        } else {
            // Fallback while the image is still loading.
            ctx.fillStyle = '#4A3728'; // --brown
            ctx.beginPath();
            ctx.arc(0, 0, vr, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#BFF366'; // --green
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.lineTo(vr, 0);
            ctx.stroke();
        }
        ctx.restore();
    }

    destroy(world) {
        Matter.Composite.remove(world, [
            this.chassis, this.frontWheel, this.rearWheel,
            this.frontConstraint, this.rearConstraint
        ]);
    }
}
