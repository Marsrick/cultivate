/* ============================================================
   吞噬成鲲 (Devour to Become Kun) - Map & Camera Manager
   ============================================================ */

class SeaMapManager {
    constructor() {
        this.bubbles = [];
        this.planktons = [];
        this.causticsPhase = 0;

        // 加载全新生成的 4K 绝美修仙深海地图背景图
        this.bgImg = new Image();
        this.bgImg.src = 'assets/bg_underwater_ocean.png';
        this.bgLoaded = false;
        this.bgImg.onload = () => { this.bgLoaded = true; };

        // 初始化背景沉浸漂浮水泡 (与相机同频，极大增强移动视觉参照)
        for (let i = 0; i < 90; i++) {
            this.bubbles.push({
                x: (Math.random() - 0.5) * 6000,
                y: (Math.random() - 0.5) * 6000,
                r: Math.random() * 6 + 2,
                speed: Math.random() * 0.8 + 0.3,
                wobble: Math.random() * Math.PI * 2
            });
        }

        // 初始化发光微粒 (浮游发光生物)
        for (let i = 0; i < 60; i++) {
            this.planktons.push({
                x: (Math.random() - 0.5) * 6000,
                y: (Math.random() - 0.5) * 6000,
                r: Math.random() * 3 + 1,
                color: Math.random() < 0.5 ? '#00f2fe' : '#ffe169',
                pulse: Math.random() * Math.PI * 2
            });
        }
    }

    update(dt) {
        this.causticsPhase += dt * 0.5;

        // 水泡更新
        this.bubbles.forEach(b => {
            b.y -= b.speed;
            b.wobble += 0.02;
            b.x += Math.sin(b.wobble) * 0.4;

            if (b.y < -3000) b.y = 3000;
        });

        // 浮游生物微光脉冲
        this.planktons.forEach(p => {
            p.pulse += dt * 2.0;
        });
    }

    drawBackground(ctx, camera) {
        const w = ctx.canvas.logicalWidth || ctx.canvas.clientWidth || ctx.canvas.width;
        const h = ctx.canvas.logicalHeight || ctx.canvas.clientHeight || ctx.canvas.height;

        ctx.save();
        if (this.bgLoaded && this.bgImg.width > 0) {
            const imgW = this.bgImg.width;
            const imgH = this.bgImg.height;

            // 1:1 绝对视角沉浸滚屏：背景海洋壁画与浮游物、怪物以 1.0x 完全同频位移
            const offsetX = (-(camera.x * 1.0) % imgW + imgW) % imgW;
            const offsetY = (-(camera.y * 1.0) % imgH + imgH) % imgH;

            // 无缝平铺背景，添加 1.5px 极小重叠防止 Canvas 亚像素缝隙黑线
            for (let x = offsetX - imgW; x < w + imgW; x += imgW) {
                for (let y = offsetY - imgH; y < h + imgH; y += imgH) {
                    ctx.drawImage(this.bgImg, Math.floor(x), Math.floor(y), imgW + 1.5, imgH + 1.5);
                }
            }
        } else {
            const grad = ctx.createRadialGradient(w / 2, h / 2, 100, w / 2, h / 2, Math.max(w, h));
            grad.addColorStop(0, '#0a355c');
            grad.addColorStop(1, '#020c1b');
            ctx.fillStyle = grad;
            ctx.fillRect(0, 0, w, h);
        }

        // 绘制动态深海水泡（跟随 camera 1.0x 位移，大幅提升全景位移参照感）
        ctx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        ctx.fillStyle = "rgba(0, 242, 254, 0.15)";
        ctx.lineWidth = 1.2;
        this.bubbles.forEach(b => {
            const screenX = b.x - camera.x + w / 2;
            const screenY = b.y - camera.y + h / 2;

            if (screenX >= -50 && screenX <= w + 50 && screenY >= -50 && screenY <= h + 50) {
                ctx.beginPath();
                ctx.arc(screenX, screenY, b.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
            }
        });

        // 绘制发光浮游微粒
        this.planktons.forEach(p => {
            const screenX = p.x - camera.x + w / 2;
            const screenY = p.y - camera.y + h / 2;

            if (screenX >= -20 && screenX <= w + 20 && screenY >= -20 && screenY <= h + 20) {
                const alpha = (Math.sin(p.pulse) + 1) * 0.4 + 0.2;
                ctx.save();
                ctx.globalAlpha = alpha;
                ctx.fillStyle = p.color;
                ctx.beginPath();
                ctx.arc(screenX, screenY, p.r, 0, Math.PI * 2);
                ctx.fill();
                ctx.restore();
            }
        });

        ctx.restore();
    }

    drawEdgeWarnings(ctx, camera, player, enemies) {
        const w = ctx.canvas.logicalWidth || ctx.canvas.clientWidth || ctx.canvas.width;
        const h = ctx.canvas.logicalHeight || ctx.canvas.clientHeight || ctx.canvas.height;

        enemies.forEach(e => {
            // 如果是危险高级怪或精英怪
            if (e.stageIdx > player.stageIdx || e.isElite) {
                const screenX = e.x - camera.x + w / 2;
                const screenY = e.y - camera.y + h / 2;

                // 超出视口时，在屏幕边缘显示警告指针
                if (screenX < 40 || screenX > w - 40 || screenY < 40 || screenY > h - 40) {
                    const angle = Math.atan2(e.y - player.y, e.x - player.x);
                    const edgeX = Math.max(40, Math.min(w - 40, w / 2 + Math.cos(angle) * (w / 2 - 50)));
                    const edgeY = Math.max(40, Math.min(h - 40, h / 2 + Math.sin(angle) * (h / 2 - 50)));

                    ctx.save();
                    ctx.translate(edgeX, edgeY);
                    ctx.rotate(angle);

                    ctx.fillStyle = e.isElite ? "#ffe169" : "#ff4d4d";
                    ctx.beginPath();
                    ctx.moveTo(15, 0);
                    ctx.lineTo(-10, -10);
                    ctx.lineTo(-5, 0);
                    ctx.lineTo(-10, 10);
                    ctx.closePath();
                    ctx.fill();

                    ctx.restore();
                }
            }
        });
    }
}
