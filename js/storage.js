/* ============================================================
   吞噬成鲲 (Devour to Become Kun) - Local Storage Manager
   ============================================================ */

class StorageManager {
    constructor() {
        this.STORAGE_KEY = "XIUXIAN_FISH_SAVE_V1";
        this.data = this.loadData();
    }

    getDefaultData() {
        return {
            userName: "深海小虾米",
            level: 12,
            coins: 23680,
            stamina: 85,
            maxStamina: 120,
            gems: 1280,
            highestStage: 7, // 鲨鱼阶段
            currentSkin: "skin_default",
            unlockedSkins: ["skin_default"],
            unlockedBios: ["tadpole", "shrimp", "fry", "clownfish", "black_carp", "puffer", "koi", "catfish", "shark"],
            upgrades: {
                speed: 4,
                range: 3,
                exp_bonus: 5,
                init_hp: 2,
                dash_cd: 3
            },
            completedTasks: ["task_1"],
            claimedTasks: [],
            settings: {
                music: true,
                sfx: true,
                vibration: true,
                dangerAlert: true,
                taskTrack: true,
                joystickMode: "floating", // fixed, floating, follow
                quality: "standard" // smooth, standard, hd
            }
        };
    }

    loadData() {
        try {
            const raw = localStorage.getItem(this.STORAGE_KEY);
            if (raw) {
                return Object.assign(this.getDefaultData(), JSON.parse(raw));
            }
        } catch (e) {
            console.warn("Save load error:", e);
        }
        return this.getDefaultData();
    }

    save() {
        try {
            localStorage.setItem(this.STORAGE_KEY, JSON.stringify(this.data));
        } catch (e) {
            console.error("Save error:", e);
        }
    }

    addCoins(amount) {
        this.data.coins += amount;
        this.save();
    }

    deductCoins(amount) {
        if (this.data.coins >= amount) {
            this.data.coins -= amount;
            this.save();
            return true;
        }
        return false;
    }

    unlockBio(id) {
        if (!this.data.unlockedBios.includes(id)) {
            this.data.unlockedBios.push(id);
            this.save();
        }
    }

    updateHighestStage(stage) {
        if (stage > this.data.highestStage) {
            this.data.highestStage = stage;
            this.save();
        }
    }
}

window.storageManager = new StorageManager();
