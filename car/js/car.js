const wheelImg = new Image();
let wheelImgReady = false;
wheelImg.onload = () => { wheelImgReady = true; };
wheelImg.src = '/assets/car/wheel.png';

const bodyImg = new Image();
let bodyImgReady = false;
let bodyImgAspect = 1;
bodyImg.onload = () => {
    bodyImgAspect = bodyImg.naturalHeight / bodyImg.naturalWidth;
    bodyImgReady = true;
};
bodyImg.onerror = () => { bodyImgReady = false; };
bodyImg.src = '/assets/car/body.png';

class Car {
    constructor(world, x, y) {
        const cfg = CAR_CONFIG;

        this.chassis = Matter.Bodies.rectangle(x, y, cfg.bodyWidth, cfg.bodyHeight, {
            friction: 0.3,

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

    applyBrakeForce() {
        const cfg = CAR_CONFIG;
        const wheels = [this.frontWheel, this.rearWheel];
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

    render(ctx, cameraX) {
        this._renderWheel(ctx, this.rearWheel, cameraX);
        this._renderWheel(ctx, this.frontWheel, cameraX);
        this._renderChassis(ctx, cameraX);
    }

    _renderChassis(ctx, cameraX) {
        const cfg = CAR_CONFIG;
        const p = this.chassis.position;

        const k = cfg.visualBodyScale || 1;
        const w = cfg.bodyWidth * k, h = cfg.bodyHeight * k;

        ctx.save();
        ctx.translate(p.x - cameraX, p.y);
        ctx.rotate(this.chassis.angle);
        ctx.translate(0, cfg.visualBodyOffsetY || 0);

        if (bodyImgReady && bodyImg.naturalWidth) {

            const drawH = w * bodyImgAspect;
            ctx.drawImage(bodyImg, -w / 2, -drawH / 2, w, drawH);
        } else {

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
            ctx.fillStyle = '#FAFFF0';
            ctx.strokeStyle = '#3D6B00';
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

        const vk = CAR_CONFIG.visualWheelScale || 1;
        const vr = CAR_CONFIG.wheelRadius * vk;
        const d = vr * 2;
        ctx.translate(p.x - cameraX, p.y + (CAR_CONFIG.wheelRadius - vr));
        ctx.rotate(wheel.angle);
        if (wheelImgReady && wheelImg.naturalWidth) {

            ctx.drawImage(wheelImg, -d / 2, -d / 2, d, d);
        } else {

            ctx.fillStyle = '#4A3728';
            ctx.beginPath();
            ctx.arc(0, 0, vr, 0, Math.PI * 2);
            ctx.fill();
            ctx.strokeStyle = '#BFF366';
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
