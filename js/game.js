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
        this.hasRevived = false;

        this.initCanvasSize();
        this.initJoystick();
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
        const updateSize = () => {
            this.canvas.width = window.innerWidth;
            this.canvas.height = window.innerHeight;
        };
        updateSize();
        window.addEventListener('resize', updateSize);
    }

    initJoystick() {
        const zone = document.getElementById('joystick-zone');
        const base = document.getElementById('joystick-base');
        const thumb = document.getElementById('joystick-thumb');
        this.joystick = new JoystickController(zone, base, thumb);
    }

    loadProgress() {
        this.updateHeaderUI();
        this.simulateLoading();
    }

    simulateLoading() {
        let progress = 0;
        const fill = document.getElementById('loading-bar-fill');
        const interval = setInterval(() => {
            progress += Math.floor(Math.random() * 20) + 15;
            if (progress >= 100) {
                progress = 100;
                clearInterval(interval);
                setTimeout(() => this.switchState("MENU"), 300);
            }
            if (fill) fill.style.width = `${progress}%`;
        }, 120);
    }

    switchState(newState) {
        this.state = newState;

        // 隐藏所有页面和弹窗
        document.querySelectorAll('.ui-screen').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.modal-overlay').forEach(m => m.classList.remove('active'));

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
        document.getElementById('user-level').innerText = `Lv.${data.level}`;
        document.getElementById('res-coins').innerText = data.coins;
        document.getElementById('res-stamina').innerText = `${data.stamina}/${data.maxStamina}`;
        document.getElementById('res-gems').innerText = data.gems;

        const currentStageInfo = EVOLUTION_STAGES[data.highestStage - 1] || EVOLUTION_STAGES[0];
        document.getElementById('highest-stage-name').innerText = `最高记录：${currentStageInfo.name}阶段`;

        // 皮肤标签更新
        const skinInfo = SKINS_DATABASE.find(s => s.id === data.currentSkin);
        const skinTag = document.getElementById('hero-current-form');
        const pStageName = (this.player && this.player.getStageInfo()) ? this.player.getStageInfo().name : currentStageInfo.name;
        if (skinTag) skinTag.innerText = `当前形态：${pStageName} (${skinInfo ? skinInfo.name : '默认'})`;
    }

    startNewGame() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
        this.player = new PlayerFish(0, 0);
        this.camera = { x: 0, y: 0 };
        this.enemies = [];
        this.survivalTime = 0;
        this.devourCount = 0;
        this.eliteDefeated = 0;
        this.hasRevived = false;

        // 局外升级加成
        const up = window.storageManager.data.upgrades;
        this.upgradeMultipliers = {
            speedBonus: (up.speed || 0) * 0.03,
            rangeBonus: (up.range || 0) * 0.04,
            expBonus: (up.exp_bonus || 0) * 0.05
        };

        // 初始刷怪（确保玩家周围安全）
        for (let i = 0; i < 35; i++) {
            this.spawnEnemy();
        }

        this.switchState("PLAYING");
        this.showToast("对局开始！吞噬较小生物成长");
    }

    spawnEnemy() {
        const angle = Math.random() * Math.PI * 2;
        const dist = Math.random() * 800 + 450;
        const ex = this.player.x + Math.cos(angle) * dist;
        const ey = this.player.y + Math.sin(angle) * dist;

        // 控难生成：70% 刷出较小可吞噬生物，30% 刷出危险生物
        let enemyStage;
        if (Math.random() < 0.7) {
            enemyStage = Math.max(0, Math.min(this.player.stageIdx, Math.floor(Math.random() * (this.player.stageIdx + 1))));
        } else {
            enemyStage = Math.min(EVOLUTION_STAGES.length - 1, this.player.stageIdx + 1 + Math.floor(Math.random() * 2));
        }

        let isElite = Math.random() < 0.08;
        this.enemies.push(new EnemyFish(ex, ey, enemyStage, isElite));
    }

    bindEvents() {
        // 主界面开始按钮
        document.getElementById('btn-start-game').addEventListener('click', () => {
            if (window.soundEngine) window.soundEngine.playClick();
            this.startNewGame();
        });

        // 四大入口
        document.getElementById('btn-menu-tasks').addEventListener('click', () => this.openModal('modal-tasks'));
        document.getElementById('btn-menu-biopedia').addEventListener('click', () => this.openModal('modal-biopedia'));
        document.getElementById('btn-menu-growth').addEventListener('click', () => this.openModal('modal-growth'));
        document.getElementById('btn-menu-skins').addEventListener('click', () => this.openModal('modal-skins'));
        document.getElementById('btn-settings').addEventListener('click', () => this.openModal('modal-settings'));

        // HUD 操作
        document.getElementById('btn-dash').addEventListener('click', () => {
            if (this.player && this.player.dash()) {
                this.updateDashCDUI();
            }
        });
        document.getElementById('btn-pause').addEventListener('click', () => {
            this.switchState("PAUSED");
            this.openModal('modal-pause');
        });

        // 通用弹窗关闭按钮
        document.querySelectorAll('.modal-close-btn, .btn-close-modal').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const modal = e.target.closest('.modal-overlay');
                if (modal) modal.classList.remove('active');
                if (this.state === "PAUSED" || this.state === "EVOLVING") this.switchState("PLAYING");
            });
        });
    }

    openModal(modalId) {
        if (window.soundEngine) window.soundEngine.playClick();
        const modal = document.getElementById(modalId);
        if (modal) {
            modal.classList.add('active');
            if (modalId === 'modal-tasks') this.renderTasksUI();
            if (modalId === 'modal-biopedia') this.renderBiopediaUI();
            if (modalId === 'modal-growth') this.renderGrowthUI();
            if (modalId === 'modal-skins') this.renderSkinsUI();
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

    updateDashCDUI() {
        const cdOverlay = document.getElementById('dash-cd-overlay');
        if (!cdOverlay) return;
        cdOverlay.style.display = 'flex';
        let remaining = this.player.dashCD;
        const interval = setInterval(() => {
            remaining -= 0.1;
            if (remaining <= 0) {
                clearInterval(interval);
                cdOverlay.style.display = 'none';
            } else {
                cdOverlay.innerText = remaining.toFixed(1);
            }
        }, 100);
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
        this.mapManager.update(dt);
        this.particles.update(dt);

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
                    if (this.player.hasShield) {
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
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);

        // 1:1 绝对死锁相机视角：主角坐标等于相机坐标，保证 100.0% 垂直水平居中
        const camera = this.player ? { x: this.player.x, y: this.player.y } : { x: 0, y: 0 };
        const centerX = Math.floor(this.canvas.width / 2);
        const centerY = Math.floor(this.canvas.height / 2);

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
            let progress = 0;
            if (task.id === 'task_1') progress = Math.min(task.req, this.devourCount);
            else if (task.id === 'task_2') progress = Math.min(task.req, Math.floor(this.survivalTime));
            else progress = Math.min(task.req, this.devourCount);

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

    renderBiopediaUI() {
        const grid = document.getElementById('biopedia-grid');
        if (!grid) return;
        const unlocked = window.storageManager.data.unlockedBios;
        const cardNames = [
            'card_stage_1_tadpole.png', 'card_stage_2_fry.png', 'card_stage_3_blackcarp.png',
            'card_stage_4_koi.png', 'card_stage_5_puffer.png', 'card_stage_6_squid.png',
            'card_stage_7_eel.png', 'card_stage_8_shark.png', 'card_stage_9_dragon.png', 'card_stage_10_kun.png'
        ];
        grid.innerHTML = BIOPEDIA_DATABASE.slice(0, 10).map((bio, idx) => {
            const isUnlocked = unlocked.includes(bio.id) || idx < 6;
            const cardImg = cardNames[idx] || cardNames[0];
            return `
                <div class="bio-card ${isUnlocked ? '' : 'locked'}" style="padding:0;overflow:hidden;border:none;box-shadow:0 6px 15px rgba(0,0,0,0.6);" onclick="window.gameEngine.showBioDetail(${idx})">
                    <img src="assets/creatures/${cardImg}" style="width:100%;height:auto;display:block;border-radius:10px;">
                </div>
            `;
        }).join('');
    }

    showBioDetail(idx) {
        const bio = BIOPEDIA_DATABASE[idx];
        if (!bio) return;
        const cardNames = [
            'card_stage_1_tadpole.png', 'card_stage_2_fry.png', 'card_stage_3_blackcarp.png',
            'card_stage_4_koi.png', 'card_stage_5_puffer.png', 'card_stage_6_squid.png',
            'card_stage_7_eel.png', 'card_stage_8_shark.png', 'card_stage_9_dragon.png', 'card_stage_10_kun.png'
        ];
        document.getElementById('bio-detail-name').innerText = `${bio.level}阶 ${bio.name}`;
        document.getElementById('bio-detail-habitat').innerText = `生活海域：${bio.habitat}`;
        document.getElementById('bio-detail-exp').innerText = `吞噬经验：${bio.exp} EXP`;
        document.getElementById('bio-detail-story').innerText = bio.story;
        document.getElementById('bio-detail-img').src = `assets/creatures/${cardNames[idx]}`;

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
                    <button class="game-btn btn-primary" onclick="window.gameEngine.buyUpgrade('${item.id}', ${cost})">
                        🪙 ${cost}
                    </button>
                </div>
            `;
        }).join('');
    }

    buyUpgrade(itemId, cost) {
        if (window.storageManager.deductCoins(cost)) {
            window.storageManager.data.upgrades[itemId] = (window.storageManager.data.upgrades[itemId] || 0) + 1;
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
            return `
                <div class="upgrade-row">
                    <div class="upgrade-meta">
                        <div class="upgrade-name" style="color:${skin.glow};">${skin.name} (${skin.category})</div>
                        <div style="font-size:12px;color:#94a3b8;">${skin.desc}</div>
                    </div>
                    <button class="game-btn ${isEquipped ? 'btn-secondary' : 'btn-primary'}" onclick="window.gameEngine.equipSkin('${skin.id}')">
                        ${isEquipped ? '使用中' : '使用'}
                    </button>
                </div>
            `;
        }).join('');
    }

    equipSkin(skinId) {
        window.storageManager.data.currentSkin = skinId;
        window.storageManager.save();
        this.showToast("成功穿戴新皮肤！");
        this.updateHeaderUI();
        this.renderSkinsUI();
    }

    updateSettings(key, value) {
        window.storageManager.data.settings[key] = value;
        window.storageManager.save();
        this.showToast("设置已保存！");
    }
}

window.addEventListener('DOMContentLoaded', () => {
    window.gameEngine = new GameEngine();
});
