/* ============================================================
   吞噬成鲲 (Devour to Become Kun) - Main Game Engine & Controller
   ============================================================ */

class GameEngine {
    constructor() {
        this.canvas = document.getElementById('game-canvas');
        this.ctx = this.canvas.getContext('2d');

        this.state = "LOADING"; // LOADING, MENU, PLAYING, PAUSED, EVOLVING, REVIVING, GAMEOVER
        this.lastTime = performance.now();

        this.player = null;
        this.enemies = [];
        this.particles = new ParticleFX();
        this.mapManager = new SeaMapManager();
        this.camera = { x: 0, y: 0 };

        this.survivalTime = 0;
        this.devourCount = 0;
        this.eliteDefeated = 0;
        this.maxCombo = 0;
        this.hasRevived = false;

        this.initCanvasSize();
        this.initJoystick();
        this.initOrientationLock();
        this.bindEvents();
        this.loadProgress();

        // 全局用户手势激活 AudioContext
        document.addEventListener('pointerdown', () => {
            if (window.soundEngine) window.soundEngine.init();
        });

        // 启动主游戏循环
        requestAnimationFrame((t) => this.loop(t));
    }

    initCanvasSize() {
        this.resizeCanvas = () => {
            const width = Math.max(1, Math.round(window.innerWidth));
            const height = Math.max(1, Math.round(window.innerHeight));
            const pixelRatio = Math.min(2, Math.max(1, window.devicePixelRatio || 1));
            const backingWidth = Math.round(width * pixelRatio);
            const backingHeight = Math.round(height * pixelRatio);

            this.viewportWidth = width;
            this.viewportHeight = height;
            this.pixelRatio = pixelRatio;
            this.canvas.logicalWidth = width;
            this.canvas.logicalHeight = height;
            this.canvas.style.width = `${width}px`;
            this.canvas.style.height = `${height}px`;

            if (this.canvas.width !== backingWidth || this.canvas.height !== backingHeight) {
                this.canvas.width = backingWidth;
                this.canvas.height = backingHeight;
            }
            this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
            this.ctx.imageSmoothingEnabled = true;
            this.ctx.imageSmoothingQuality = 'high';
        };
        this.resizeCanvas();
        window.addEventListener('resize', this.resizeCanvas);
    }

    initJoystick() {
        const zone = document.getElementById('joystick-zone');
        const base = document.getElementById('joystick-base');
        const thumb = document.getElementById('joystick-thumb');
        this.joystick = new JoystickController(zone, base, thumb);
    }

    initOrientationLock() {
        this.orientationGate = document.getElementById('orientation-gate');
        this.orientationStatus = document.getElementById('orientation-status');
        this.orientationButton = document.getElementById('btn-enter-landscape');

        this.updateOrientationGate = () => {
            const isPortrait = window.matchMedia('(orientation: portrait)').matches;
            if (this.orientationGate) {
                this.orientationGate.classList.toggle('active', isPortrait);
                this.orientationGate.setAttribute('aria-hidden', String(!isPortrait));
            }
            if (!isPortrait && this.orientationStatus) {
                this.orientationStatus.textContent = '已切换横屏，正在进入修仙海域';
            }
            this.resizeCanvas();
        };

        if (this.orientationButton) {
            this.orientationButton.addEventListener('click', async () => {
                if (window.soundEngine) window.soundEngine.playClick();
                await this.enterLandscapeMode(true);
            });
        }

        window.addEventListener('resize', this.updateOrientationGate);
        if (screen.orientation && typeof screen.orientation.addEventListener === 'function') {
            screen.orientation.addEventListener('change', this.updateOrientationGate);
        }
        document.addEventListener('fullscreenchange', this.updateOrientationGate);
        this.updateOrientationGate();

        const isStandalone = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
        if (isStandalone) {
            Promise.resolve().then(() => this.enterLandscapeMode(false));
        }
    }

    async enterLandscapeMode(fromUserGesture = false) {
        const isPortrait = window.matchMedia('(orientation: portrait)').matches;
        if (!isPortrait) {
            this.updateOrientationGate();
            return true;
        }

        if (this.orientationStatus) {
            this.orientationStatus.textContent = '正在请求全屏与横屏权限…';
        }

        if (fromUserGesture && !document.fullscreenElement && document.documentElement.requestFullscreen) {
            try {
                await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
            } catch (_) {
                // 某些移动浏览器不允许网页全屏，继续尝试独立的方向锁。
            }
        }

        if (screen.orientation && typeof screen.orientation.lock === 'function') {
            try {
                await screen.orientation.lock('landscape');
            } catch (_) {
                // 方向锁是受限能力，失败时保留可操作的旋转提示。
            }
        }

        this.updateOrientationGate();
        const switched = !window.matchMedia('(orientation: portrait)').matches;
        if (!switched && this.orientationStatus) {
            this.orientationStatus.textContent = '系统未允许自动旋转，请关闭手机方向锁后横放设备，再点一次重试';
        }
        return switched;
    }

    loadProgress() {
        this.updateHeaderUI();
        this.simulateLoading();
    }

    simulateLoading() {
        let progress = 0;
        let interfaceReady = false;
        let assetsReady = false;
        let finished = false;
        const fill = document.getElementById('loading-bar-fill');
        const finish = () => {
            if (finished || !interfaceReady || !assetsReady) return;
            finished = true;
            setTimeout(() => this.switchState("MENU"), 180);
        };

        Promise.resolve(window.MOTION_ASSETS_READY)
            .catch(() => [])
            .then(() => {
                assetsReady = true;
                finish();
            });

        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 20) + 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                interfaceReady = true;
                finish();
            }
            if (fill) fill.style.width = `${progress}%`;
        }, 120);
    }

    switchState(newState) {
        this.state = newState;

        // 隐藏所有页面和弹窗
        document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.modal-overlay').forEach(m => {
            m.classList.remove('active');
            m.setAttribute('aria-hidden', 'true');
        });
        document.body.classList.remove('modal-open');

        if (newState === "LOADING") {
            document.getElementById('screen-loading').classList.add('active');
        } else if (newState === "MENU") {
            document.getElementById('screen-main-menu').classList.add('active');
            this.updateHeaderUI();
        } else if (newState === "PLAYING") {
            document.getElementById('screen-gameplay').classList.add('active');
        }
    }

    updateHeaderUI() {
        const data = window.storageManager.data;
        document.getElementById('user-name').innerText = data.userName;
        document.getElementById('user-level').innerText = data.level;
        const levelText = document.getElementById('user-level-text');
        if (levelText) levelText.innerText = `Lv.${data.level}`;
        document.getElementById('res-coins').innerText = data.coins;
        document.getElementById('res-stamina').innerText = `${data.stamina}/${data.maxStamina}`;
        document.getElementById('res-gems').innerText = data.gems;

        const highestStageInfo = EVOLUTION_STAGES[data.highestStage - 1] || EVOLUTION_STAGES[0];
        const showcaseStageInfo = EVOLUTION_STAGES[(data.menuStage || 4) - 1] || EVOLUTION_STAGES[3];
        document.getElementById('highest-stage-name').innerHTML = `最高记录：<span>${highestStageInfo.name}阶段</span>`;

        // 皮肤标签更新
        const skinInfo = SKINS_DATABASE.find(s => s.id === data.currentSkin);
        const skinTag = document.getElementById('hero-current-form');
        if (skinTag) skinTag.innerHTML = `当前形态：<span>${showcaseStageInfo.name}</span>`;
    }

    startNewGame() {
        this.resizeCanvas();
        this.player = new PlayerFish(0, 0);
        this.camera = { x: 0, y: 0 };
        this.enemies = [];
        this.survivalTime = 0;
        this.devourCount = 0;
        this.eliteDefeated = 0;
        this.maxCombo = 0;
        this.hasRevived = false;

        // 局外升级加成
        const up = window.storageManager.data.upgrades;
        this.upgradeMultipliers = {
            speedBonus: (up.speed || 0) * 0.03,
            rangeBonus: (up.range || 0) * 0.04,
            expBonus: (up.exp_bonus || 0) * 0.05,
            dashCdReduction: Math.min(0.5, (up.dash_cd || 0) * 0.05)
        };
        this.player.dashCooldownMultiplier = 1 - this.upgradeMultipliers.dashCdReduction;

        // 初始刷怪（确保玩家周围安全）
        for (let i = 0; i < 35; i++) {
            this.spawnEnemy();
        }

        this.switchState("PLAYING");
        this.showToast("对局开始！吞噬较小生物成长");
    }

    spawnEnemy() {
        // 控难生成：70% 刷出较小可吞噬生物，30% 刷出危险生物
        let enemyStage;
        if (Math.random() < 0.7) {
            enemyStage = Math.max(0, Math.min(this.player.stageIdx, Math.floor(Math.random() * (this.player.stageIdx + 1))));
        } else {
            enemyStage = Math.min(EVOLUTION_STAGES.length - 1, this.player.stageIdx + 1 + Math.floor(Math.random() * 2));
        }

        const angle = Math.random() * Math.PI * 2;
        const safeDistance = enemyStage > this.player.stageIdx ? 900 : 450;
        const dist = Math.random() * 800 + safeDistance;
        const ex = this.player.x + Math.cos(angle) * dist;
        const ey = this.player.y + Math.sin(angle) * dist;

        let isElite = Math.random() < 0.08;
        this.enemies.push(new EnemyFish(ex, ey, enemyStage, isElite));
    }

    bindEvents() {
        // 主界面开始按钮
        document.getElementById('btn-start-game').addEventListener('click', async () => {
            if (window.soundEngine) window.soundEngine.playClick();
            const landscapeReady = await this.enterLandscapeMode(true);
            if (!landscapeReady) return;
            this.startNewGame();
        });

        // 四大入口
        document.getElementById('btn-menu-tasks').addEventListener('click', () => this.openModal('modal-tasks'));
        document.getElementById('btn-menu-biopedia').addEventListener('click', () => this.openModal('modal-biopedia'));
        document.getElementById('btn-menu-growth').addEventListener('click', () => this.openModal('modal-growth'));
        document.getElementById('btn-menu-skins').addEventListener('click', () => this.openModal('modal-skins'));
        document.getElementById('btn-settings').addEventListener('click', () => this.openModal('modal-settings'));

        // HUD 操作
        document.getElementById('btn-dash').addEventListener('click', () => this.tryDash());
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.switchState("PAUSED");
            this.openModal('modal-pause');
        });

        // 通用弹窗关闭按钮
        document.querySelectorAll('.modal-close-btn, .btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                this.closeModal(modal);
            });
        });

        document.querySelectorAll('.modal-overlay').forEach(modal => {
            modal.setAttribute('aria-hidden', 'true');
            modal.addEventListener('pointerdown', (event) => {
                if (event.target !== modal) return;
                if (modal.id === 'modal-revive' || modal.id === 'modal-settlement') return;
                this.closeModal(modal);
            });
        });

        document.addEventListener('keydown', (event) => {
            const isDashKey = event.code === 'Space'
                || event.code === 'ShiftLeft'
                || event.code === 'ShiftRight';
            if (isDashKey && this.state === "PLAYING") {
                event.preventDefault();
                if (!event.repeat) this.tryDash();
                return;
            }
            if (event.key !== 'Escape') return;
            const activeModals = [...document.querySelectorAll('.modal-overlay.active')];
            const modal = activeModals[activeModals.length - 1];
            if (!modal || modal.id === 'modal-revive' || modal.id === 'modal-settlement') return;
            this.closeModal(modal);
        });
    }

    closeModal(modal) {
        if (!modal) return;
        modal.classList.remove('active');
        modal.setAttribute('aria-hidden', 'true');
        if (!document.querySelector('.modal-overlay.active')) {
            document.body.classList.remove('modal-open');
        }
        if (this.state === "PAUSED" || this.state === "EVOLVING") this.switchState("PLAYING");
        if (modal._returnFocus && document.contains(modal._returnFocus)) {
            modal._returnFocus.focus({ preventScroll: true });
        }
    }

    openModal(modalId) {
        if (window.soundEngine) window.soundEngine.playClick();
        const modal = document.getElementById(modalId);
        if (modal) {
            modal._returnFocus = document.activeElement;
            modal.classList.add('active');
            modal.setAttribute('aria-hidden', 'false');
            document.body.classList.add('modal-open');
            if (modalId === 'modal-tasks') this.renderTasksUI();
            if (modalId === 'modal-biopedia') this.renderBiopediaUI();
            if (modalId === 'modal-growth') this.renderGrowthUI();
            if (modalId === 'modal-skins') this.renderSkinsUI();
            if (modalId === 'modal-settings') this.renderSettingsUI();
            requestAnimationFrame(() => {
                const focusTarget = modal.querySelector('.modal-close-btn, .game-btn:not([disabled]), button:not([disabled])');
                if (focusTarget) focusTarget.focus({ preventScroll: true });
            });
        }
    }

    showToast(msg) {
        const container = document.getElementById('toast-container');
        if (!container) return;
        const toast = document.createElement('div');
        toast.className = 'toast-message';
        toast.innerText = msg;
        container.appendChild(toast);
        setTimeout(() => toast.remove(), 1800);
    }

    tryDash() {
        if (this.state !== "PLAYING" || !this.player) return false;
        const activated = this.player.dash(this.joystick.getVector());
        this.updateDashCDUI();
        return activated;
    }

    updateDashCDUI() {
        const dashButton = document.getElementById('btn-dash');
        const cdOverlay = document.getElementById('dash-cd-overlay');
        if (!dashButton || !cdOverlay) return;

        const remaining = Math.max(0, this.player?.dashCD || 0);
        const isCoolingDown = remaining > 0;
        dashButton.disabled = isCoolingDown;
        dashButton.classList.toggle('cooldown', isCoolingDown);
        cdOverlay.style.display = isCoolingDown ? 'flex' : 'none';
        cdOverlay.innerText = isCoolingDown ? remaining.toFixed(1) : '';
    }

    loop(timestamp) {
        const dt = Math.min((timestamp - this.lastTime) / 1000, 0.1);
        this.lastTime = timestamp;

        if (this.state === "PLAYING") {
            this.updateGameplay(dt);
        }

        this.renderCanvas();

        requestAnimationFrame((t) => this.loop(t));
    }

    updateGameplay(dt) {
        this.survivalTime += dt;
        const inputVec = this.joystick.getVector();
        this.player.update(dt, inputVec, this.upgradeMultipliers);
        this.updateDashCDUI();
        this.mapManager.update(dt);
        this.particles.update(dt);

        // 1:1 绝对视角锁死：每帧平移相机坐标完全等于主角坐标
        if (this.player) {
            this.camera.x = this.player.x;
            this.camera.y = this.player.y;
        }

        // 离远清理与怪物动态补充
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            if (Math.hypot(e.x - this.player.x, e.y - this.player.y) > 2000) {
                this.enemies.splice(i, 1);
            }
        }
        while (this.enemies.length < 35) {
            this.spawnEnemy();
        }

        const pStageInfo = this.player.getStageInfo();
        const pRadius = pStageInfo.radius * (1 + this.upgradeMultipliers.rangeBonus);

        // 碰撞与吞噬判定
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const e = this.enemies[i];
            e.update(dt, this.player);

            const dist = Math.hypot(e.x - this.player.x, e.y - this.player.y);
            const eStageInfo = e.getStageInfo();

            if (dist < pRadius + eStageInfo.radius * 0.7) {
                if (this.player.stageIdx >= e.stageIdx) {
                    // 吞噬生物！
                    this.enemies.splice(i, 1);
                    this.devourCount++;
                    if (e.isElite) this.eliteDefeated++;

                    this.player.combo++;
                    this.player.comboTimer = 3.0;
                    this.maxCombo = Math.max(this.maxCombo, this.player.combo);

                    let gainExp = eStageInfo.reqExp * 0.3 * (1 + this.upgradeMultipliers.expBonus);
                    if (this.player.combo > 1) gainExp *= (1 + Math.min(1.0, this.player.combo * 0.05));

                    this.player.exp += Math.round(gainExp);
                    this.particles.addDevourBurst(e.x, e.y, eStageInfo.color);
                    this.particles.addExpText(e.x, e.y, `+${Math.round(gainExp)} EXP`);

                    if (window.soundEngine) window.soundEngine.playDevour();

                    // 精准解封图鉴
                    const bio = BIOPEDIA_DATABASE[e.stageIdx];
                    window.storageManager.unlockBio(bio ? bio.id : "tadpole");

                    // 检查形态进化
                    if (this.player.exp >= pStageInfo.reqExp && this.player.stageIdx < EVOLUTION_STAGES.length - 1) {
                        this.triggerEvolution();
                    }
                } else {
                    // 被大鱼碰撞：受创或致死
                    if (this.player.spawnProtectionTimer > 0) {
                        this.enemies.splice(i, 1);
                    } else if (this.player.hasShield) {
                        this.player.hasShield = false;
                        this.enemies.splice(i, 1);
                        this.showToast("🛡️ 护盾抵挡了一次致命攻击！");
                    } else {
                        this.handlePlayerDeath();
                        break;
                    }
                }
            }
        }

        this.updateGameplayHUD();
    }

    triggerEvolution() {
        this.switchState("EVOLVING"); // 暂停战斗逻辑
        this.player.exp = 0;
        this.player.stageIdx++;
        const nextInfo = this.player.getStageInfo();

        window.storageManager.updateHighestStage(this.player.stageIdx + 1);
        if (window.soundEngine) window.soundEngine.playEvolve();

        document.getElementById('evo-stage-name').innerText = nextInfo.name;
        document.getElementById('evo-stat-speed').innerText = `+${Math.round(nextInfo.speed * 10)}%`;
        document.getElementById('evo-stat-range').innerText = `+${Math.round(nextInfo.radius * 0.5)}%`;

        this.openModal('modal-evolution');
    }

    handlePlayerDeath() {
        if (!this.hasRevived) {
            // 弹出 P05 复活弹窗
            this.switchState("REVIVING");
            if (window.soundEngine) window.soundEngine.playWarning();

            const pInfo = this.player.getStageInfo();
            const pct = Math.min(100, Math.round((this.player.exp / pInfo.reqExp) * 100));
            document.getElementById('revive-info-text').innerText = `本局阶段：${pInfo.name}（进度 ${pct}%）`;

            this.openModal('modal-revive');
        } else {
            this.confirmGameOver();
        }
    }

    revivePlayer() {
        this.hasRevived = true;
        this.player.hasShield = true;
        this.player.shieldTimer = 3.0;
        this.player.spawnProtectionTimer = 3.0;
        this.switchState("PLAYING");
        document.getElementById('modal-revive').classList.remove('active');
        this.showToast("✨ 复活成功！获得 3 秒护盾保护");
    }

    confirmGameOver() {
        this.switchState("GAMEOVER");
        if (window.soundEngine) window.soundEngine.playWarning();

        const earnedCoins = Math.round(this.devourCount * 12 + this.survivalTime * 2);
        window.storageManager.addCoins(earnedCoins);

        document.getElementById('settle-highest-stage').innerText = `最高形态：${this.player.getStageInfo().name}`;
        document.getElementById('settle-survival-time').innerText = `${Math.floor(this.survivalTime / 60)}:${Math.floor(this.survivalTime % 60).toString().padStart(2, '0')}`;
        document.getElementById('settle-devour-count').innerText = this.devourCount;
        document.getElementById('settle-coins').innerText = earnedCoins;

        this.openModal('modal-settlement');
    }

    updateGameplayHUD() {
        const info = this.player.getStageInfo();
        document.getElementById('hud-form-name').innerText = `阶段${this.player.stageIdx + 1} ${info.name}`;

        const pct = Math.min(100, Math.round((this.player.exp / info.reqExp) * 100));
        document.getElementById('hud-exp-fill').style.width = `${pct}%`;
        document.getElementById('hud-exp-text').innerText = `${this.player.exp}/${info.reqExp} (${pct}%)`;

        const mins = Math.floor(this.survivalTime / 60).toString().padStart(2, '0');
        const secs = Math.floor(this.survivalTime % 60).toString().padStart(2, '0');
        document.getElementById('hud-timer').innerText = `${mins}:${secs}`;

        // 实时追踪任务进度
        document.getElementById('hud-task-text').innerText = `当前任务：已吞噬 ${this.devourCount} 只生物`;
    }

    renderCanvas() {
        const pixelRatio = this.pixelRatio || 1;
        this.ctx.setTransform(1, 0, 0, 1, 0, 0);
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        this.ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';

        // 1:1 绝对死锁相机视角：主角坐标等于相机坐标，保证 100.0% 垂直水平居中
        const camera = this.player ? { x: this.player.x, y: this.player.y } : { x: 0, y: 0 };
        const centerX = Math.floor((this.viewportWidth || window.innerWidth) / 2);
        const centerY = Math.floor((this.viewportHeight || window.innerHeight) / 2);

        // 绘制海域背景
        this.mapManager.drawBackground(this.ctx, camera);

        if (this.player) {
            this.ctx.save();
            this.ctx.translate(centerX - camera.x, centerY - camera.y);

            // 绘制敌对怪物
            this.enemies.forEach(e => e.draw(this.ctx, this.player.stageIdx));

            // 绘制玩家角色
            const skinId = window.storageManager.data.currentSkin;
            const skinInfo = SKINS_DATABASE.find(s => s.id === skinId);
            this.player.draw(this.ctx, skinInfo ? skinInfo.glow : null);

            // 绘制粒子
            this.particles.draw(this.ctx);

            this.ctx.restore();

            // 绘制屏幕边缘警告指针
            this.mapManager.drawEdgeWarnings(this.ctx, camera, this.player, this.enemies);
        }
    }

    renderTasksUI() {
        const container = document.getElementById('tasks-list-container');
        if (!container) return;

        const claimed = window.storageManager.data.claimedTasks || [];
        container.innerHTML = TASK_LIST.map(task => {
            const isClaimed = claimed.includes(task.id);
            const progress = this.getTaskProgress(task);

            const canClaim = !isClaimed && progress >= task.req;

            return `
                <div class="task-item-card">
                    <div class="task-info-left">
                        <div class="task-title">${task.title}</div>
                        <div class="task-desc" style="font-size:12px;color:#94a3b8;">${task.desc} (${progress}/${task.req})</div>
                        <div class="task-reward">奖励：🪙 ${task.rewardCoin} 金币</div>
                    </div>
                    ${isClaimed 
                        ? `<button disabled class="game-btn btn-secondary" style="opacity:0.6;">已领取</button>`
                        : canClaim 
                        ? `<button class="game-btn btn-primary" onclick="window.gameEngine.claimTask('${task.id}')">领取</button>`
                        : `<button disabled class="game-btn btn-secondary" style="opacity:0.5;">进行中</button>`
                    }
                </div>
            `;
        }).join('');
    }

    claimTask(taskId) {
        const task = TASK_LIST.find(t => t.id === taskId);
        if (task) {
            if (this.getTaskProgress(task) < task.req) {
                this.showToast("任务尚未完成");
                return;
            }
            window.storageManager.data.claimedTasks = window.storageManager.data.claimedTasks || [];
            if (!window.storageManager.data.claimedTasks.includes(taskId)) {
                window.storageManager.data.claimedTasks.push(taskId);
                window.storageManager.addCoins(task.rewardCoin);
                this.showToast(`🎉 成功领取 ${task.rewardCoin} 金币奖励！`);
                this.updateHeaderUI();
                this.renderTasksUI();
            }
        }
    }

    getTaskProgress(task) {
        let progress = 0;
        if (task.id === 'task_1') progress = this.devourCount;
        else if (task.id === 'task_2') progress = Math.floor(this.survivalTime);
        else if (task.id === 'task_3') progress = this.maxCombo;
        else if (task.id === 'task_4') {
            const runStage = this.player ? this.player.stageIdx + 1 : 1;
            progress = Math.max(runStage, window.storageManager.data.highestStage || 1);
        } else if (task.id === 'task_5') progress = this.eliteDefeated;
        return Math.min(task.req, progress);
    }

    renderBiopediaUI() {
        const grid = document.getElementById('biopedia-grid');
        if (!grid) return;
        const bios = [...BIOPEDIA_DATABASE].sort((a, b) => a.level - b.level);
        const highestStage = Math.max(1, Math.min(10, Number(window.storageManager.data.highestStage) || 1));
        const unlockedCount = bios.filter((bio) => bio.level <= highestStage).length;
        const progress = document.getElementById('biopedia-progress');
        if (progress) progress.innerText = `${unlockedCount} / ${bios.length} 已解锁`;

        grid.innerHTML = bios.map((bio) => {
            const isUnlocked = bio.level <= highestStage;
            return `
                <button
                    type="button"
                    class="bio-card ${isUnlocked ? '' : 'locked'}"
                    data-bio-id="${bio.id}"
                    aria-label="${bio.level}阶 ${bio.name}${isUnlocked ? '，查看详情' : '，未解锁'}"
                    ${isUnlocked ? '' : 'disabled'}
                >
                    <img src="assets/creatures/${bio.card}" alt="${bio.level}阶 ${bio.name}" loading="eager">
                    ${isUnlocked ? '' : `<span class="bio-lock-label">达到 ${bio.level} 阶解锁</span>`}
                </button>
            `;
        }).join('');

        grid.querySelectorAll('.bio-card:not(:disabled)').forEach((card) => {
            card.addEventListener('click', () => this.showBioDetail(card.dataset.bioId));
        });
    }

    showBioDetail(bioId) {
        const bio = BIOPEDIA_DATABASE.find((item) => item.id === bioId);
        if (!bio) return;
        const highestStage = Math.max(1, Math.min(10, Number(window.storageManager.data.highestStage) || 1));
        if (bio.level > highestStage) return;

        const typeLabels = {
            common: '普通形态',
            rare: '稀有形态',
            epic: '强袭形态',
            mythic: '神话形态'
        };
        document.getElementById('bio-detail-title').innerText = `${bio.level}阶形态档案`;
        document.getElementById('bio-detail-stage').innerText = `${bio.level}阶`;
        document.getElementById('bio-detail-type').innerText = typeLabels[bio.type] || '进化形态';
        document.getElementById('bio-detail-name').innerText = bio.name;
        document.getElementById('bio-detail-habitat').innerText = bio.habitat;
        document.getElementById('bio-detail-exp').innerText = `${bio.exp} EXP`;
        document.getElementById('bio-detail-story').innerText = bio.story;
        const detailImg = document.getElementById('bio-detail-img');
        detailImg.src = `assets/creatures/${bio.card}`;
        detailImg.alt = `${bio.level}阶 ${bio.name}完整图鉴卡`;

        document.getElementById('modal-bio-detail').classList.add('active');
    }

    renderGrowthUI() {
        const list = document.getElementById('upgrade-list-container');
        if (!list) return;
        const upData = window.storageManager.data.upgrades;
        list.innerHTML = UPGRADE_ITEMS.map(item => {
            const curLv = upData[item.id] || 0;
            const cost = item.baseCost + curLv * item.costInc;
            return `
                <div class="upgrade-row">
                    <div class="upgrade-meta">
                        <div class="upgrade-name">${item.icon} ${item.name} Lv.${curLv}</div>
                        <div class="upgrade-level-dots">
                            ${Array.from({length: item.maxLv}).map((_, idx) => `<div class="level-dot ${idx < curLv ? 'active' : ''}"></div>`).join('')}
                        </div>
                    </div>
                    <button class="game-btn ${curLv >= item.maxLv ? 'btn-secondary' : 'btn-primary'}" ${curLv >= item.maxLv ? 'disabled' : ''} onclick="window.gameEngine.buyUpgrade('${item.id}')">
                        ${curLv >= item.maxLv ? '已满级' : `🪙 ${cost}`}
                    </button>
                </div>
            `;
        }).join('');
    }

    buyUpgrade(itemId) {
        const item = UPGRADE_ITEMS.find(entry => entry.id === itemId);
        if (!item) return;
        const currentLevel = window.storageManager.data.upgrades[itemId] || 0;
        if (currentLevel >= item.maxLv) {
            this.showToast("该强化已经满级");
            return;
        }
        const cost = item.baseCost + currentLevel * item.costInc;
        if (window.storageManager.deductCoins(cost)) {
            window.storageManager.data.upgrades[itemId] = currentLevel + 1;
            window.storageManager.save();
            this.showToast("升级成功！属性已提升");
            this.updateHeaderUI();
            this.renderGrowthUI();
        } else {
            this.showToast("金币不足！无法升级");
        }
    }

    renderSkinsUI() {
        const container = document.getElementById('skins-list-container');
        if (!container) return;
        const data = window.storageManager.data;
        container.innerHTML = SKINS_DATABASE.map(skin => {
            const isEquipped = data.currentSkin === skin.id;
            const isUnlocked = (data.unlockedSkins || []).includes(skin.id) || skin.unlocked;
            return `
                <div class="upgrade-row">
                    <div class="upgrade-meta">
                        <div class="upgrade-name" style="color:${skin.glow};">${skin.name} (${skin.category})</div>
                        <div style="font-size:12px;color:#94a3b8;">${skin.desc}</div>
                    </div>
                    <button class="game-btn ${isEquipped ? 'btn-secondary' : 'btn-primary'}" ${isEquipped ? 'disabled' : ''} onclick="window.gameEngine.equipSkin('${skin.id}')">
                        ${isEquipped ? '使用中' : isUnlocked ? '使用' : `🪙 ${skin.price} 解锁`}
                    </button>
                </div>
            `;
        }).join('');
    }

    equipSkin(skinId) {
        const skin = SKINS_DATABASE.find(entry => entry.id === skinId);
        if (!skin) return;
        const data = window.storageManager.data;
        data.unlockedSkins = data.unlockedSkins || ['skin_default'];
        const isUnlocked = data.unlockedSkins.includes(skinId) || skin.unlocked;
        if (!isUnlocked) {
            if (!window.storageManager.deductCoins(skin.price)) {
                this.showToast("金币不足，无法解锁该皮肤");
                return;
            }
            data.unlockedSkins.push(skinId);
        }
        data.currentSkin = skinId;
        window.storageManager.save();
        this.showToast(isUnlocked ? "成功穿戴新皮肤！" : "皮肤已解锁并穿戴！");
        this.updateHeaderUI();
        this.renderSkinsUI();
    }

    updateSettings(key, value) {
        window.storageManager.data.settings[key] = value;
        window.storageManager.save();
        this.showToast("设置已保存！");
    }

    renderSettingsUI() {
        const settings = window.storageManager.data.settings || {};
        const sfx = document.getElementById('setting-sfx');
        const danger = document.getElementById('setting-danger');
        const taskTrack = document.getElementById('setting-tasktrack');
        const joystick = document.getElementById('setting-joystick');
        if (sfx) sfx.checked = settings.sfx !== false;
        if (danger) danger.checked = settings.dangerAlert !== false;
        if (taskTrack) taskTrack.checked = settings.taskTrack !== false;
        if (joystick) joystick.value = settings.joystickMode || 'floating';
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new GameEngine();
});
