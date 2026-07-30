// V25 使用 10 张高清透明母版做连续形变动画。
// 不再叠加不同动作帧，避免半透明双影、亮度跳变与高分屏放大模糊。
const STAGE_MASTER_SPRITES = [];
const MASTER_SPRITE_LOADS = [];
for (let s = 1; s <= 10; s++) {
    const img = new Image();
    img.decoding = 'async';
    const load = new Promise((resolve) => {
        img.onload = () => resolve(true);
        img.onerror = () => resolve(false);
    });
    img.src = `assets/creatures_motion_v25/masters/stage_${s}_master.png`;
    STAGE_MASTER_SPRITES[s - 1] = img;
    MASTER_SPRITE_LOADS.push(load);
}
window.MOTION_ASSETS_READY = Promise.all(MASTER_SPRITE_LOADS);

function drawContinuousSprite(ctx, sprite, x, y, width, height, options = {}) {
    if (!sprite || !sprite.complete || sprite.naturalWidth <= 0) return false;

    const phase = options.phase || 0;
    const amplitude = options.amplitude || 0;
    const waveStart = Math.max(0.16, Math.min(0.72, options.waveStart || 0.5));
    const sourceW = sprite.naturalWidth;
    const sourceH = sprite.naturalHeight;
    const bodySourceW = Math.max(1, Math.round(sourceW * waveStart));
    const bodyDestW = width * waveStart;

    // 头部与身体保持一个完整、全不透明的绘制层，保证眼睛和鳞片始终锐利。
    ctx.drawImage(
        sprite,
        0,
        0,
        bodySourceW,
        sourceH,
        x,
        y,
        bodyDestW + 1,
        height
    );

    // 只对后半身做连续尾摆；相邻切片轻微重叠，避免 Canvas 亚像素缝隙。
    const tailSlices = width >= 380 ? 18 : width >= 180 ? 14 : 10;
    const tailSourceW = sourceW - bodySourceW;
    const tailDestW = width - bodyDestW;
    for (let i = 0; i < tailSlices; i++) {
        const t0 = i / tailSlices;
        const t1 = (i + 1) / tailSlices;
        const sourceX = bodySourceW + Math.floor(t0 * tailSourceW);
        const nextSourceX = bodySourceW + Math.ceil(t1 * tailSourceW);
        const sourceSliceW = Math.max(1, nextSourceX - sourceX);
        const destX = x + bodyDestW + t0 * tailDestW;
        const destSliceW = Math.max(1, (t1 - t0) * tailDestW + 1.1);
        const weight = Math.pow((t0 + t1) * 0.5, 1.75);
        const offsetY = Math.sin(phase + weight * 1.15) * amplitude * height * weight;

        ctx.drawImage(
            sprite,
            sourceX,
            0,
            sourceSliceW,
            sourceH,
            destX,
            y + offsetY,
            destSliceW,
            height
        );
    }
    return true;
}

class PlayerFish {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;
        this.lastMoveDirection = { x: 1, y: 0 };
        this.dashDirection = { x: 1, y: 0 };

        this.stageIdx = 0; // 蝌蚪 (Stage 1, 0-indexed: 0)
        this.exp = 0;
        this.combo = 0;
        this.comboTimer = 0;

        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCD = 0;
        this.dashCooldownMultiplier = 1;
        this.hasShield = false;
        this.shieldTimer = 0;
        this.isHurt = false;
        this.hurtTimer = 0;
        this.isDead = false;
        this.spawnProtectionTimer = 12;

        this.animTime = 0;
        this.motionBlend = 0;
    }

    getStageInfo() {
        return EVOLUTION_STAGES[this.stageIdx] || EVOLUTION_STAGES[0];
    }

    update(dt, inputVector = { x: 0, y: 0 }, upgradeMultipliers = { speedBonus: 0 }) {
        this.animTime += dt;

        const info = this.getStageInfo();
        // 数据中的速度沿用原 60fps 手感，但位移按 dt 结算，避免高刷新率设备移动过快。
        const speed = info.speed * 60 * (1 + (upgradeMultipliers.speedBonus || 0));
        const inputX = Number.isFinite(inputVector.x) ? inputVector.x : 0;
        const inputY = Number.isFinite(inputVector.y) ? inputVector.y : 0;
        const inputMagnitude = Math.hypot(inputX, inputY);
        const isMovingInput = inputMagnitude > 0.01;
        const inputDirection = isMovingInput
            ? { x: inputX / inputMagnitude, y: inputY / inputMagnitude }
            : this.lastMoveDirection;

        if (isMovingInput) this.lastMoveDirection = { ...inputDirection };

        if (this.dashCD > 0) this.dashCD = Math.max(0, this.dashCD - dt);
        if (this.isDashing) {
            this.dashTimer = Math.max(0, this.dashTimer - dt);
            if (this.dashTimer <= 0) this.isDashing = false;
        }

        if (this.shieldTimer > 0) {
            this.shieldTimer -= dt;
            if (this.shieldTimer <= 0) {
                this.hasShield = false;
            }
        }

        if (this.hurtTimer > 0) {
            this.hurtTimer -= dt;
            if (this.hurtTimer <= 0) this.isHurt = false;
        }

        if (this.spawnProtectionTimer > 0) {
            this.spawnProtectionTimer = Math.max(0, this.spawnProtectionTimer - dt);
        }

        const motionTarget = isMovingInput || this.isDashing ? 1 : 0;
        this.motionBlend += (motionTarget - this.motionBlend) * (1 - Math.exp(-dt * 8));
        if (this.isDashing) {
            const dashSpeed = speed * 2.6;
            this.vx = this.dashDirection.x * dashSpeed;
            this.vy = this.dashDirection.y * dashSpeed;
        } else if (isMovingInput) {
            const targetAngle = Math.atan2(inputDirection.y, inputDirection.x);
            // 角度平滑插值旋转
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            const turnLerp = 1 - Math.pow(1 - 0.18, dt * 60);
            this.angle += diff * turnLerp;

            this.vx = Math.cos(this.angle) * speed;
            this.vy = Math.sin(this.angle) * speed;
        } else {
            const drag = Math.pow(0.90, dt * 60);
            this.vx *= drag;
            this.vy *= drag;
        }

        this.x += this.vx * dt;
        this.y += this.vy * dt;

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 0;
        }
    }

    dash(inputVector = null) {
        if (this.isDead || this.dashCD > 0) return false;

        const inputX = Number.isFinite(inputVector?.x) ? inputVector.x : 0;
        const inputY = Number.isFinite(inputVector?.y) ? inputVector.y : 0;
        const inputMagnitude = Math.hypot(inputX, inputY);
        const direction = inputMagnitude > 0.08
            ? { x: inputX / inputMagnitude, y: inputY / inputMagnitude }
            : this.lastMoveDirection;

        this.dashDirection = { ...direction };
        this.lastMoveDirection = { ...direction };
        this.angle = Math.atan2(direction.y, direction.x);
        this.isDashing = true;
        this.dashTimer = 0.55;
        this.dashCD = 4.0 * this.dashCooldownMultiplier;

        const immediateDashSpeed = this.getStageInfo().speed * 60 * 2.6;
        this.vx = direction.x * immediateDashSpeed;
        this.vy = direction.y * immediateDashSpeed;

        if (window.soundEngine) window.soundEngine.playDash();
        return true;
    }

    getMotionProfile(isMoving) {
        const isLongBody = this.stageIdx === 5 || this.stageIdx === 8;
        const waveStart = isLongBody ? 0.22 : 0.5;

        if (this.isDead) {
            return { amplitude: 0, frequency: 0, rotation: 0.22, scaleX: 0.985, scaleY: 0.985, waveStart };
        }
        if (this.isHurt) {
            return { amplitude: 0.018, frequency: 13, rotation: -0.11, scaleX: 0.96, scaleY: 1.04, waveStart };
        }
        if (this.isDashing) {
            return { amplitude: 0.012, frequency: 14, rotation: 0, scaleX: 1.055, scaleY: 0.955, waveStart };
        }
        if (isMoving) {
            return {
                amplitude: isLongBody ? 0.048 : 0.03,
                frequency: isLongBody ? 8.4 : 7.4,
                rotation: 0,
                scaleX: 1,
                scaleY: 1,
                waveStart
            };
        }
        return {
            amplitude: isLongBody ? 0.02 : 0.01,
            frequency: 2.5,
            rotation: 0,
            scaleX: 1,
            scaleY: 1,
            waveStart
        };
    }

    draw(ctx, skinColor) {
        const info = this.getStageInfo();
        const r = info.radius;
        const color = skinColor || info.color;

        // Keep the player readable against detailed scenery and similarly sized creatures.
        const markerRadius = Math.max(34, r * 2.5);
        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.shadowColor = 'rgba(0, 242, 254, 0.9)';
        ctx.shadowBlur = 12;
        ctx.strokeStyle = 'rgba(126, 249, 255, 0.92)';
        ctx.lineWidth = 2.5;
        ctx.beginPath();
        ctx.arc(0, 0, markerRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.shadowBlur = 5;
        ctx.fillStyle = '#fff4b0';
        ctx.font = '700 13px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('主角', 0, -markerRadius - 9);
        ctx.restore();

        ctx.save();
        const cosA = Math.cos(this.angle);
        const sinA = Math.sin(this.angle);
        ctx.translate(this.x, this.y);

        // 360度数学正交矩阵变换：头部精确对齐游动方向，背鳍 100% 垂直朝上，绝不出现仰泳
        if (cosA < 0) {
            ctx.transform(-cosA, -sinA, sinA, -cosA, 0, 0);
        } else {
            ctx.transform(-cosA, -sinA, -sinA, cosA, 0, 0);
        }

        // 底层软光晕
        const aura = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.5);
        aura.addColorStop(0, color);
        aura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        const isMoving = Math.hypot(this.vx, this.vy) > 0.3;
        const motion = this.getMotionProfile(isMoving);
        const sprite = STAGE_MASTER_SPRITES[this.stageIdx];

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            // 视觉物理重心微调：补偿纹理留白，保证主角 100.0% 精确居中于 (0,0)
            const visualScale = Math.max(1.3, 3.6 - this.stageIdx * 0.23);
            const drawX = -r * 1.5 * visualScale;
            const drawY = -r * 1.02 * visualScale;
            const drawW = r * 3 * visualScale;
            const drawH = r * 2.2 * visualScale;
            const idleLift = Math.sin(this.animTime * 2.6) * r * 0.02 * (1 - this.motionBlend);

            ctx.translate(0, idleLift);
            if (motion.rotation) ctx.rotate(motion.rotation);
            ctx.scale(motion.scaleX, motion.scaleY);
            drawContinuousSprite(ctx, sprite, drawX, drawY, drawW, drawH, {
                phase: this.animTime * motion.frequency,
                amplitude: motion.amplitude,
                waveStart: motion.waveStart
            });
        } else {
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        if (this.isDashing) {
            ctx.strokeStyle = "#00f2fe";
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.arc(r * 1.2, 0, r * 0.5, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.hasShield) {
            ctx.strokeStyle = "#00f2fe";
            ctx.lineWidth = 3.5;
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.35, 0, Math.PI * 2);
            ctx.stroke();
        }

        if (this.spawnProtectionTimer > 0) {
            const pulse = 0.82 + Math.sin(this.animTime * 7) * 0.12;
            ctx.globalAlpha = pulse;
            ctx.strokeStyle = '#ffd86a';
            ctx.lineWidth = 3;
            ctx.setLineDash([8, 7]);
            ctx.beginPath();
            ctx.arc(0, 0, r * 1.65, 0, Math.PI * 2);
            ctx.stroke();
            ctx.setLineDash([]);
            ctx.globalAlpha = 1;
        }

        ctx.restore();
    }
}

class EnemyFish {
    constructor(x, y, stageIdx, isElite = false) {
        this.x = x;
        this.y = y;
        this.stageIdx = stageIdx;
        this.isElite = isElite;
        this.angle = Math.random() * Math.PI * 2;
        this.targetAngle = this.angle;
        this.animTime = Math.random() * 10;
        this.changeDirTimer = Math.random() * 3 + 1;
        this.vx = 0;
        this.vy = 0;
        this.isHurt = false;
        this.isDead = false;
    }

    getStageInfo() {
        return EVOLUTION_STAGES[this.stageIdx] || EVOLUTION_STAGES[0];
    }

    update(dt, player) {
        this.animTime += dt;
        this.changeDirTimer -= dt;

        const info = this.getStageInfo();
        let speed = info.speed * 60 * 0.65;

        // 定时随机巡航转向
        if (this.changeDirTimer <= 0) {
            this.targetAngle += (Math.random() - 0.5) * 1.5;
            this.changeDirTimer = Math.random() * 3 + 1.5;
        }

        // AI 避让大鱼，追逐小鱼
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (player.spawnProtectionTimer > 0 && this.stageIdx > player.stageIdx && dist < 560) {
            this.targetAngle = Math.atan2(this.y - player.y, this.x - player.x);
            speed *= 1.2;
        } else if (dist < 320) {
            if (this.stageIdx < player.stageIdx) {
                // 逃跑：背向玩家
                this.targetAngle = Math.atan2(this.y - player.y, this.x - player.x);
                speed *= 1.25;
            } else if (this.stageIdx > player.stageIdx) {
                // 追击：面向玩家
                this.targetAngle = Math.atan2(player.y - this.y, player.x - this.x);
                speed *= 1.15;
            }
        }

        // 关键修复：敌鱼角度平滑插值旋转，确保物理移动向量 (vx, vy) 与绘制旋转角 this.angle 100% 绝对一致
        let diff = this.targetAngle - this.angle;
        while (diff < -Math.PI) diff += Math.PI * 2;
        while (diff > Math.PI) diff -= Math.PI * 2;
        const turnLerp = 1 - Math.pow(1 - 0.12, dt * 60);
        this.angle += diff * turnLerp;

        this.vx = Math.cos(this.angle) * speed;
        this.vy = Math.sin(this.angle) * speed;

        this.x += this.vx * dt;
        this.y += this.vy * dt;
    }

    draw(ctx, playerStageIdx) {
        const info = this.getStageInfo();
        let r = info.radius * (this.isElite ? 1.35 : 1.0);

        ctx.save();
        const cosA = Math.cos(this.angle);
        const sinA = Math.sin(this.angle);
        ctx.translate(this.x, this.y);

        // 360度数学正交矩阵变换：头部精确对齐游动方向，背鳍 100% 垂直朝上，绝不出现仰泳
        if (cosA < 0) {
            ctx.transform(-cosA, -sinA, sinA, -cosA, 0, 0);
        } else {
            ctx.transform(-cosA, -sinA, -sinA, cosA, 0, 0);
        }

        const sprite = STAGE_MASTER_SPRITES[this.stageIdx];

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            const visualScale = Math.max(1.05, 2.3 - this.stageIdx * 0.13);
            const isLongBody = this.stageIdx === 5 || this.stageIdx === 8;
            const hurtRotation = this.isHurt ? -0.09 : 0;
            if (hurtRotation) ctx.rotate(hurtRotation);
            drawContinuousSprite(
                ctx,
                sprite,
                -r * 1.4 * visualScale,
                -r * 1.0 * visualScale,
                r * 2.8 * visualScale,
                r * 2.0 * visualScale,
                {
                    phase: this.animTime * (isLongBody ? 7.8 : 6.8),
                    amplitude: this.isHurt ? 0.018 : (isLongBody ? 0.046 : 0.028),
                    waveStart: isLongBody ? 0.22 : 0.5
                }
            );
        } else {
            ctx.fillStyle = info.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制等级与精英标志（重置坐标，保证文字在鱼头上方水平书写）
        ctx.restore(); // 恢复当前鱼体旋转缩放，单独绘制 UI 文字
        ctx.save();
        ctx.translate(this.x, this.y);
        if (this.isElite) {
            ctx.fillStyle = "#ffe169";
            ctx.font = "bold 13px sans-serif";
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 4;
            ctx.fillText(`👑 Lv.${this.stageIdx + 1} 精英`, -26, -r - 8);
        } else if (playerStageIdx !== undefined && this.stageIdx > playerStageIdx) {
            ctx.fillStyle = "#ff4d4d";
            ctx.font = "bold 12px sans-serif";
            ctx.shadowColor = "rgba(0,0,0,0.8)";
            ctx.shadowBlur = 4;
            ctx.fillText(`Lv.${this.stageIdx + 1}`, -14, -r - 6);
        }
        ctx.restore();
    }
}

class ParticleFX {
    constructor() {
        this.particles = [];
        this.floaters = [];
    }

    addDevourBurst(x, y, color) {
        for (let i = 0; i < 12; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 4 + 2;
            this.particles.push({
                x: x, y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 5 + 3,
                color: color,
                alpha: 1.0,
                life: 0.4
            });
        }
    }

    addExpText(x, y, text, color = "#ffe169") {
        this.floaters.push({
            x: x, y: y,
            text: text,
            color: color,
            alpha: 1.0,
            life: 0.8
        });
    }

    update(dt) {
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const p = this.particles[i];
            p.x += p.vx * 60 * dt;
            p.y += p.vy * 60 * dt;
            p.life -= dt;
            p.alpha = Math.max(0, p.life / 0.4);
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            f.y -= 72 * dt;
            f.life -= dt;
            f.alpha = Math.max(0, f.life / 0.8);
            if (f.life <= 0) this.floaters.splice(i, 1);
        }
    }

    draw(ctx) {
        this.particles.forEach(p => {
            ctx.save();
            ctx.globalAlpha = p.alpha;
            ctx.fillStyle = p.color;
            ctx.beginPath();
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        });

        this.floaters.forEach(f => {
            ctx.save();
            ctx.globalAlpha = f.alpha;
            ctx.fillStyle = f.color;
            ctx.font = "bold 16px sans-serif";
            ctx.fillText(f.text, f.x - 20, f.y);
            ctx.restore();
        });
    }
}
