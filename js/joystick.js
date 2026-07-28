
/* ============================================================
   吞噬成鲲 (Devour to Become Kun) - Virtual Joystick & Keyboard Controls
   ============================================================ */

class JoystickController {
    constructor(zoneElem, baseElem, thumbElem) {
        this.zone = zoneElem;
        this.base = baseElem;
        this.thumb = thumbElem;

        this.active = false;
        this.pointerId = null;
        this.centerPos = { x: 0, y: 0 };
        this.vector = { x: 0, y: 0 };
        this.maxRadius = 45;

        // 键盘按键映射
        this.keys = { W: false, A: false, S: false, D: false, ArrowUp: false, ArrowLeft: false, ArrowDown: false, ArrowRight: false };

        this.initEvents();
    }

    initEvents() {
        if (!this.zone) return;

        this.touchId = null;

        const onStart = (e) => {
            if (this.active) return;
            if (e.cancelable) e.preventDefault();
            const touch = e.targetTouches ? e.targetTouches[0] : e;
            if (!touch) return;

            this.active = true;
            this.touchId = touch.identifier !== undefined ? touch.identifier : null;

            const rect = this.zone.getBoundingClientRect();
            this.centerPos = {
                x: rect.left + rect.width / 2,
                y: rect.top + rect.height / 2
            };

            this.updatePosition(touch.clientX, touch.clientY);
        };

        const onMove = (e) => {
            if (!this.active) return;
            let touch = e;
            if (e.touches && this.touchId !== null) {
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === this.touchId) {
                        touch = e.touches[i];
                        break;
                    }
                }
            }
            this.updatePosition(touch.clientX, touch.clientY);
        };

        const onEnd = (e) => {
            if (e.touches && this.touchId !== null) {
                for (let i = 0; i < e.touches.length; i++) {
                    if (e.touches[i].identifier === this.touchId) return; // 摇杆触点尚未抬起
                }
            }
            this.active = false;
            this.touchId = null;
            this.vector = { x: 0, y: 0 };
            this.thumb.style.transform = `translate(-50%, -50%)`;
        };

        this.zone.addEventListener('mousedown', onStart);
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onEnd);

        this.zone.addEventListener('touchstart', onStart, { passive: false });
        window.addEventListener('touchmove', onMove, { passive: false });
        window.addEventListener('touchend', onEnd);

        // 键盘操控支持
        window.addEventListener('keydown', (e) => {
            const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = true;
            }
        });
        window.addEventListener('keyup', (e) => {
            const key = e.key.length === 1 ? e.key.toUpperCase() : e.key;
            if (this.keys.hasOwnProperty(key)) {
                this.keys[key] = false;
            }
        });
    }

    updatePosition(clientX, clientY) {
        let dx = clientX - this.centerPos.x;
        let dy = clientY - this.centerPos.y;
        let dist = Math.hypot(dx, dy);

        if (dist > this.maxRadius) {
            dx = (dx / dist) * this.maxRadius;
            dy = (dy / dist) * this.maxRadius;
            dist = this.maxRadius;
        }

        this.vector.x = dx / this.maxRadius;
        this.vector.y = dy / this.maxRadius;

        this.thumb.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`;
    }

    getVector() {
        let vx = this.vector.x;
        let vy = this.vector.y;

        // 如果没有手势，响应键盘
        if (vx === 0 && vy === 0) {
            if (this.keys.W || this.keys.ArrowUp) vy -= 1;
            if (this.keys.S || this.keys.ArrowDown) vy += 1;
            if (this.keys.A || this.keys.ArrowLeft) vx -= 1;
            if (this.keys.D || this.keys.ArrowRight) vx += 1;

            if (vx !== 0 && vy !== 0) {
                vx *= 0.7071;
                vy *= 0.7071;
            }
        }

        return { x: vx, y: vy };
    }
}
