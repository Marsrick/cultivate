// 全量预加载 动作图 目录提取的 10 阶段共 80 帧官方动作精灵序列
const STAGE_MOTION_FRAMES = [];
for (let s = 1; s <= 10; s++) {
    STAGE_MOTION_FRAMES[s - 1] = [];
    for (let f = 0; f < 8; f++) {
        const img = new Image();
        img.src = `assets/creatures_motion/stage_${s}_frame_${f}.png`;
        STAGE_MOTION_FRAMES[s - 1][f] = img;
    }
}

class PlayerFish {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.vx = 0;
        this.vy = 0;
        this.angle = 0;

        this.stageIdx = 3; // 锦鲤 (Stage 4, 0-indexed: 3)
        this.exp = 0;
        this.combo = 0;
        this.comboTimer = 0;

        this.isDashing = false;
        this.dashTimer = 0;
        this.dashCD = 0;
        this.hasShield = false;
        this.isHurt = false;
        this.hurtTimer = 0;
        this.isDead = false;

        this.animTime = 0;
    }

    getStageInfo() {
        return EVOLUTION_STAGES[this.stageIdx];
    }

    update(dt, inputVector, upgradeMultipliers) {
        this.animTime += dt;

        const info = this.getStageInfo();
        let speed = info.speed * (1 + upgradeMultipliers.speedBonus);

        if (this.dashCD > 0) this.dashCD -= dt;
        if (this.isDashing) {
            speed *= 2.0;
            this.dashTimer -= dt;
            if (this.dashTimer <= 0) {
                this.isDashing = false;
            }
        }

        if (this.hurtTimer > 0) {
            this.hurtTimer -= dt;
            if (this.hurtTimer <= 0) this.isHurt = false;
        }

        const isMovingInput = (inputVector.x !== 0 || inputVector.y !== 0);
        if (isMovingInput) {
            const targetAngle = Math.atan2(inputVector.y, inputVector.x);
            // 角度平滑插值旋转
            let diff = targetAngle - this.angle;
            while (diff < -Math.PI) diff += Math.PI * 2;
            while (diff > Math.PI) diff -= Math.PI * 2;
            this.angle += diff * 0.18;

            this.vx = Math.cos(this.angle) * speed;
            this.vy = Math.sin(this.angle) * speed;
        } else {
            this.vx *= 0.90;
            this.vy *= 0.90;
        }

        this.x += this.vx;
        this.y += this.vy;

        if (this.comboTimer > 0) {
            this.comboTimer -= dt;
            if (this.comboTimer <= 0) this.combo = 0;
        }
    }

    dash() {
        if (this.dashCD <= 0) {
            this.isDashing = true;
            this.dashTimer = 1.2;
            this.dashCD = 4.0;
            if (window.soundEngine) window.soundEngine.playDash();
            return true;
        }
        return false;
    }

    getFrameIndex(isMoving) {
        if (this.isDead) return 7; // 帧8: 死亡帧
        if (this.isHurt) return 6; // 帧7: 受击帧
        if (this.isDashing) return 5; // 帧6: 冲刺帧

        if (isMoving) {
            // 游动动画: 3 → 4 → 5 → 4 (索引 [2, 3, 4, 3])
            const swimSeq = [2, 3, 4, 3];
            const step = Math.floor(this.animTime * 8) % 4;
            return swimSeq[step];
        } else {
            // 待机动画: 1 → 2 → 1 → 2 (索引 [0, 1, 0, 1])
            const idleSeq = [0, 1, 0, 1];
            const step = Math.floor(this.animTime * 3) % 4;
            return idleSeq[step];
        }
    }

    draw(ctx, skinColor) {
        const info = this.getStageInfo();
        const r = info.radius;
        const color = skinColor || info.color;

        ctx.save();
        ctx.translate(this.x, this.y);
        ctx.rotate(this.angle + Math.PI);

        // 底层软光晕
        const aura = ctx.createRadialGradient(0, 0, r * 0.4, 0, 0, r * 1.5);
        aura.addColorStop(0, color);
        aura.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = aura;
        ctx.beginPath();
        ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
        ctx.fill();

        const isMoving = Math.hypot(this.vx, this.vy) > 0.3;
        const fIdx = this.getFrameIndex(isMoving);
        const frames = STAGE_MOTION_FRAMES[this.stageIdx];
        const sprite = frames ? frames[fIdx] : null;

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, -r * 1.5, -r * 1.1, r * 3, r * 2.2);
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
        let speed = info.speed * 0.65;

        // 定时随机巡航转向
        if (this.changeDirTimer <= 0) {
            this.targetAngle += (Math.random() - 0.5) * 1.5;
            this.changeDirTimer = Math.random() * 3 + 1.5;
        }

        // AI 避让大鱼，追逐小鱼
        const dist = Math.hypot(player.x - this.x, player.y - this.y);
        if (dist < 320) {
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
        this.angle += diff * 0.12;

        this.vx = Math.cos(this.angle) * speed;
        this.vy = Math.sin(this.angle) * speed;

        this.x += this.vx;
        this.y += this.vy;
    }

    getFrameIndex() {
        if (this.isDead) return 7;
        if (this.isHurt) return 6;

        // 游动动画: 3 → 4 → 5 → 4 (对应索引 [2, 3, 4, 3])
        const swimSeq = [2, 3, 4, 3];
        const step = Math.floor(this.animTime * 7) % 4;
        return swimSeq[step];
    }

    draw(ctx, playerStageIdx) {
        const info = this.getStageInfo();
        let r = info.radius * (this.isElite ? 1.35 : 1.0);

        ctx.save();
        ctx.translate(this.x, this.y);
        // 关键修复：敌鱼图片原图鱼头朝左，旋转角增加 Math.PI，完全对齐实际物理移动角度 (this.angle)
        ctx.rotate(this.angle + Math.PI);

        const fIdx = this.getFrameIndex();
        const frames = STAGE_MOTION_FRAMES[this.stageIdx];
        const sprite = frames ? frames[fIdx] : null;

        if (sprite && sprite.complete && sprite.naturalWidth > 0) {
            ctx.drawImage(sprite, -r * 1.4, -r * 1.0, r * 2.8, r * 2.0);
        } else {
            ctx.fillStyle = info.color;
            ctx.beginPath();
            ctx.ellipse(0, 0, r, r * 0.6, 0, 0, Math.PI * 2);
            ctx.fill();
        }

        // 绘制等级与精英标志（重置旋转视角，保证文字水平书写）
        ctx.save();
        ctx.rotate(-(this.angle + Math.PI));
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
            p.x += p.vx;
            p.y += p.vy;
            p.life -= dt;
            p.alpha = Math.max(0, p.life / 0.4);
            if (p.life <= 0) this.particles.splice(i, 1);
        }

        for (let i = this.floaters.length - 1; i >= 0; i--) {
            const f = this.floaters[i];
            f.y -= 1.2;
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
