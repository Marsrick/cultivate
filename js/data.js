/* ============================================================
   吞噬成鲲 (Devour to Become Kun) - Game Database & Definitions
   ============================================================ */

const EVOLUTION_STAGES = [
    { stage: 1, name: "蝌蚪", reqExp: 100, radius: 12, speed: 2.6, color: "#34d399", desc: "弱小的水下初始形态" },
    { stage: 2, name: "鱼苗", reqExp: 220, radius: 18, speed: 2.7, color: "#38bdf8", desc: "刚学会游动的小鱼苗" },
    { stage: 3, name: "青鱼", reqExp: 380, radius: 26, speed: 2.8, color: "#0284c7", desc: "普通深海青鱼，游速稍有提升" },
    { stage: 4, name: "锦鲤", reqExp: 600, radius: 36, speed: 2.9, color: "#ff7675", desc: "吉祥祥瑞之鱼，吞噬吸收更快" },
    { stage: 5, name: "鲶鱼", reqExp: 950, radius: 48, speed: 3.0, color: "#6c5ce7", desc: "大口鲶鱼，可轻松吞噬小型游鱼" },
    { stage: 6, name: "电鳗", reqExp: 1400, radius: 62, speed: 3.1, color: "#fdcb6e", desc: "带电灵鱼，威慑力大增" },
    { stage: 7, name: "鲨鱼", reqExp: 2000, radius: 78, speed: 3.2, color: "#00bec4", desc: "海域霸主之一，凶猛无匹" },
    { stage: 8, name: "蛟",   reqExp: 3000, radius: 96, speed: 3.4, color: "#a29bfe", desc: "化蛟在即，已具备灵智与威压" },
    { stage: 9, name: "鲲",   reqExp: 5000, radius: 118, speed: 3.6, color: "#ffe169", desc: "北冥有鱼，其名为鲲，化而为鸟，其名为鹏" },
    { stage: 10, name: "鹏",  reqExp: 8000, radius: 145, speed: 3.8, color: "#f43f5e", desc: "扶摇直上九万里，遮天蔽日终极霸主" }
];

const BIOPEDIA_DATABASE = [
    { id: "tadpole", name: "蝌蚪", level: 1, type: "common", habitat: "浅水湾", exp: 10, story: "幼小的水生生物，四处寻找小微粒生存。" },
    { id: "fry", name: "鱼苗", level: 2, type: "common", habitat: "浅水湾", exp: 25, story: "微小的小鱼苗，聚集在水草丛中。" },
    { id: "black_carp", name: "青鱼", level: 3, type: "common", habitat: "暗流平原", exp: 50, story: "体型修长，力气不小。" },
    { id: "koi", name: "锦鲤", level: 4, type: "common", habitat: "福泽海域", exp: 90, story: "蕴含祥瑞气息的吉祥之鱼。" },
    { id: "catfish", name: "鲶鱼", level: 5, type: "common", habitat: "淤泥海沟", exp: 160, story: "触须敏感，口吞百物。" },
    { id: "electric_eel", name: "电鳗", level: 6, type: "common", habitat: "风雷海域", exp: 250, story: "体内蕴含强劲电流。" },
    { id: "shark", name: "鲨鱼", level: 7, type: "common", habitat: "深海大峡谷", exp: 400, story: "嗅觉极其灵敏，游速极快。" },
    { id: "flood_dragon", name: "蛟龙", level: 8, type: "mythic", habitat: "归墟之地", exp: 700, story: "神话生物！即将渡劫成龙。" },
    { id: "ancient_kun", name: "北冥巨鲲", level: 9, type: "mythic", habitat: "九天沧海", exp: 1200, story: "神话终极生物！吞吐天地万物。" },
    { id: "golden_roc", name: "九天金鹏", level: 10, type: "mythic", habitat: "无尽虚空", exp: 2500, story: "化而为鸟，其名为鹏，扶摇直上九万里！" }
];

const UPGRADE_ITEMS = [
    { id: "speed", name: "移动速度", maxLv: 10, baseCost: 300, costInc: 200, unit: "%", incPerLv: 3, icon: "⚡" },
    { id: "range", name: "吞噬范围", maxLv: 10, baseCost: 400, costInc: 250, unit: "%", incPerLv: 4, icon: "🧲" },
    { id: "exp_bonus", name: "经验加成", maxLv: 10, baseCost: 500, costInc: 300, unit: "%", incPerLv: 5, icon: "✨" },
    { id: "init_hp", name: "初始生命", maxLv: 5, baseCost: 600, costInc: 400, unit: "点", incPerLv: 1, icon: "❤️" },
    { id: "dash_cd", name: "冲刺冷却", maxLv: 5, baseCost: 450, costInc: 300, unit: "%", incPerLv: -5, icon: "🌀" }
];

const TASK_LIST = [
    { id: "task_1", type: "novice", title: "初出茅庐", desc: "吞噬 20 只小鱼生物", req: 20, rewardCoin: 500, rewardExp: 100 },
    { id: "task_2", type: "daily", title: "海域探险家", desc: "单局存活时间达到 3 分钟", req: 180, rewardCoin: 800, rewardExp: 150 },
    { id: "task_3", type: "daily", title: "大块朵颐", desc: "达成 10 连击吞噬", req: 10, rewardCoin: 600, rewardExp: 120 },
    { id: "task_4", type: "growth", title: "进化之路", desc: "成功进化至鲨鱼形态", req: 7, rewardCoin: 1500, rewardExp: 300 },
    { id: "task_5", type: "achievement", title: "霸主降临", desc: "击败或吞噬 3 只精英怪", req: 3, rewardCoin: 3000, rewardExp: 600 }
];

const SKINS_DATABASE = [
    { id: "skin_default", name: "默认海洋", category: "普通", unlocked: true, price: 0, glow: "#38bdf8", desc: "经典的蔚蓝海洋流光皮肤" },
    { id: "skin_gold", name: "黄金帝王", category: "国风", unlocked: false, price: 5000, glow: "#ffe169", desc: "金光熠熠，彰显修仙尊贵身份" },
    { id: "skin_deepsea", name: "深海幽光鲲", category: "深海", unlocked: false, price: 8000, glow: "#a855f7", desc: "散发幽紫萤光的神秘深海物种" },
    { id: "skin_mecha", name: "赛博机械鲲", category: "机械", unlocked: false, price: 12000, glow: "#00f2fe", desc: "未来合金打造的钢铁海域怪物" }
];
