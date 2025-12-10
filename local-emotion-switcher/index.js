/**
 * SillyTavern 本地情绪表情切换插件 (修正版)
 * 功能：根据用户或AI消息中的关键词，自动切换角色表情图片。
 */

(function() {
    'use strict'; // 修正：使用英文单引号

    // ==================== 配置区 (用户请修改这里) ====================
    const CONFIG = {
        // 1. 你的角色名（必须与聊天界面显示的角色名完全一致）
        targetCharacterName: "Plana",

        // 2. 情绪关键词映射库 (情绪标签: [关键词数组])
        // 情绪标签（如 `joy`）必须与您角色卡`expressions`映射中的文件名（如`joy.png`）一致
        emotionKeywords: {
            "admiration": ["钦佩", "佩服", "敬佩", "欣赏", "值得学习", "典范"],
            "amusement": ["有趣", "好笑", "滑稽", "逗", "真有意思", "幽默"],
            "anger": ["生气", "愤怒", "恼火", "发怒", "气愤", "怒"],
            "annoyance": ["烦人", "烦躁", "讨厌", "恼人", "麻烦", "不快"],
            "approval": ["赞同", "同意", "认可", "不错", "很好", "可以"],
            "caring": ["关心", "担心", "保重", "注意安全", "别太累", "照顾"],
            "confusion": ["困惑", "不解", "迷惑", "不明白", "什么意思", "不懂"],
            "curiosity": ["好奇", "想知道", "疑问", "怎么回事", "为什么", "如何"],
            "desire": ["想要", "希望", "渴望", "期待", "愿", "好想"],
            "disappointment": ["失望", "遗憾", "可惜", "失落", "不如预期", "哎"],
            "disapproval": ["反对", "不赞成", "不好", "不该这样", "不同意"],
            "disgust": ["恶心", "厌恶", "反感", "讨厌", "受不了", "作呕"],
            "embarrassment": ["尴尬", "窘迫", "不好意思", "难为情", "丢脸", "社死"],
            "excitement": ["兴奋", "激动", "振奋", "好耶", "来了兴致", "雀跃"],
            "fear": ["害怕", "恐惧", "担心", "恐慌", "吓人", "可怕"],
            "gratitude": ["感谢", "谢谢", "感激", "多谢", "辛苦了", "感恩"],
            "grief": ["悲痛", "哀伤", "心碎", "悲伤欲绝", "难过", "痛心"],
            "joy": ["高兴", "开心", "快乐", "喜悦", "欢喜", "愉快"],
            "love": ["爱", "喜欢", "爱你", "疼爱", "好感", "倾心"],
            "nervousness": ["紧张", "不安", "忐忑", "心慌", "焦虑", "没底"],
            "neutral": ["嗯", "哦", "好的", "明白", "知道了", "是吗"],
            "optimism": ["乐观", "有信心", "会好的", "相信", "希望", "积极"],
            "pride": ["骄傲", "自豪", "得意", "厉害", "不愧是你", "做得好"],
            "realization": ["明白了", "懂了", "原来如此", "意识到", "恍然大悟", "哦~"],
            "relief": ["松了口气", "安心", "放松", "放心了", "宽慰", "还好"],
            "remorse": ["后悔", "懊悔", "自责", "抱歉", "不该那样", "是我的错"],
            "sadness": ["悲伤", "难过", "伤心", "忧郁", "低落", "唉"],
            "surprise": ["惊讶", "惊奇", "吃惊", "居然", "哇", "没想到"]// 默认或平静状态
         },

        // 3. 图片路径模板 (非常重要！)
        // `{emotion}` 会被自动替换为情绪标签，如 `joy`
        // 请根据您的实际存放路径修改，确保能正确指向图片
        imagePathTemplate: "https://raw.githubusercontent.com/asrieldummur/test/main/expressions/{emotion}.png",

        // 4. 要控制的头像/立绘图片的 CSS 选择器 (可能需要调整)
        // 这是SillyTavern中显示角色头像的HTML元素的标识符
        avatarImageSelector: "#characterImageContainer img, .avatar img, .character-image",

        // 调试模式：开启后会在浏览器控制台显示详细日志
        debugMode: true
    };
    // ==================== 配置结束 ====================

    // 主逻辑：等待页面加载完成后运行
    setTimeout(initializePlugin, 2000);

    function initializePlugin() {
        if (CONFIG.debugMode) console.log('[情绪插件] 正在初始化...');

        // 1. 监听聊天消息的添加
        const chatContainer = document.getElementById('chat');
        if (!chatContainer) {
            if (CONFIG.debugMode) console.error('[情绪插件] 未找到聊天容器，插件加载失败。');
            // 延迟重试一次，等待SillyTavern完全加载
            setTimeout(() => {
                const retryContainer = document.getElementById('chat');
                if (retryContainer) initializePlugin();
            }, 3000);
            return;
        }

        // 使用 MutationObserver 监听聊天内容变化
        const observer = new MutationObserver(function(mutations) {
            try {
                for (let mutation of mutations) {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // 新消息添加，尝试处理最后一条消息
                        setTimeout(processLatestMessage, 100);
                        break; // 处理一次即可
                    }
                }
            } catch (err) {
                if (CONFIG.debugMode) console.error('[情绪插件] 监听消息时出错:', err);
            }
        });

        observer.observe(chatContainer, { childList: true, subtree: true });

        if (CONFIG.debugMode) console.log('[情绪插件] 初始化完成，正在监听消息。');
    }

    /**
     * 处理最新的一条消息
     */
    function processLatestMessage() {
        try {
            const messages = document.querySelectorAll('.mes, .message');
            if (messages.length === 0) return;

            const lastMessage = messages[messages.length - 1];
            const isUserMessage = lastMessage.hasAttribute('is_user') ? lastMessage.getAttribute('is_user') === 'true' : lastMessage.classList.contains('user');

            // 策略：根据最新消息的发送者决定分析哪条消息
            let textToAnalyze = '';
            let isTargetCharacter = false;

            if (isUserMessage) {
                // 如果最新消息是用户发的，则分析上一条AI消息（如果有）
                if (messages.length >= 2) {
                    const prevMessage = messages[messages.length - 2];
                    textToAnalyze = getMessageText(prevMessage);
                    isTargetCharacter = isMessageFromTargetCharacter(prevMessage);
                }
            } else {
                // 如果最新消息是AI发的，直接分析它
                textToAnalyze = getMessageText(lastMessage);
                isTargetCharacter = isMessageFromTargetCharacter(lastMessage);
            }

            if (!isTargetCharacter) {
                if (CONFIG.debugMode) console.log('[情绪插件] 最新消息不是目标角色，跳过。');
                return;
            }

            if (CONFIG.debugMode) console.log(`[情绪插件] 分析目标角色消息: "${textToAnalyze.substring(0, 50)}..."`);

            const detectedEmotion = analyzeEmotion(textToAnalyze);
            if (detectedEmotion) {
                changeExpression(detectedEmotion);
            }
        } catch (err) {
            if (CONFIG.debugMode) console.error('[情绪插件] 处理消息时出错:', err);
        }
    }

    /**
     * 从消息DOM元素中提取纯文本
     */
    function getMessageText(messageElement) {
        // 优先查找消息文本部分
        const textElement = messageElement.querySelector('.mes_text, .message-text, .text');
        let rawText = textElement ? textElement.innerText : messageElement.innerText;

        // 清理文本：移除多余空格、换行，过滤掉系统指令（如/me等）
        rawText = rawText.replace(/\s+/g, ' ').trim();
        rawText = rawText.replace(/^\/[a-zA-Z]+\s*/, ''); // 去除开头的命令

        return rawText;
    }

    /**
     * 判断消息是否来自目标角色
     */
    function isMessageFromTargetCharacter(messageElement) {
        // 方法1：检查角色名元素
        const nameElement = messageElement.querySelector('.ch_name, .character-name, .name');
        if (nameElement && nameElement.innerText.trim() === CONFIG.targetCharacterName) {
            return true;
        }

        // 方法2：如果无法通过名字判断，默认所有非用户消息都来自目标角色（适用于单角色聊天）
        // 这是一个备选逻辑，如果方法1不准，可以尝试注释掉方法2或反过来
        const isUser = messageElement.hasAttribute('is_user') ? messageElement.getAttribute('is_user') === 'true' : messageElement.classList.contains('user');
        if (!isUser) {
            return true; // 假设非用户消息都是目标角色
        }

        return false;
    }

    /**
     * 核心分析函数：通过关键词匹配情绪
     */
    function analyzeEmotion(text) {
        const lowerText = text.toLowerCase();
        let detectedEmotion = null;
        let highestPriority = -1;

        // 简单的关键词匹配逻辑
        for (const [emotion, keywords] of Object.entries(CONFIG.emotionKeywords)) {
            for (const keyword of keywords) {
                if (lowerText.includes(keyword.toLowerCase())) {
                    // 简单的优先级：关键词越靠前，优先级越高（可在配置中扩展为权重）
                    const priority = keywords.indexOf(keyword);
                    if (priority > highestPriority) {
                        highestPriority = priority;
                        detectedEmotion = emotion;
                    }
                    break; // 找到该情绪的一个关键词就跳出内层循环
                }
            }
        }

        if (CONFIG.debugMode) {
            if (detectedEmotion) {
                console.log(`[情绪插件] 情绪分析结果: “${text}” -> ${detectedEmotion}`);
            } else {
                console.log(`[情绪插件] 未匹配到关键词，使用默认或保持原状。`);
            }
        }

        return detectedEmotion || 'neutral'; // 未匹配时返回中性
    }

    /**
     * 切换表情图片
     */
    function changeExpression(emotion) {
        try {
            const imagePath = CONFIG.imagePathTemplate.replace('{emotion}', emotion);
            const images = document.querySelectorAll(CONFIG.avatarImageSelector);

            if (images.length === 0) {
                if (CONFIG.debugMode) console.error(`[情绪插件] 未找到头像图片元素，请检查选择器: ${CONFIG.avatarImageSelector}`);
                return;
            }

            let changed = false;
            images.forEach(img => {
                // 创建一个新的URL以避免缓存问题，并比较路径的结尾部分
                const fullNewPath = window.location.origin + imagePath;
                const currentSrc = img.src ? new URL(img.src, window.location.origin).pathname : '';
                const newSrcPath = new URL(fullNewPath).pathname;

                if (currentSrc !== newSrcPath) {
                    img.src = fullNewPath;
                    changed = true;
                    // 可以添加一个简单的过渡效果
                    img.style.opacity = '0.7';
                    setTimeout(() => { img.style.opacity = '1'; }, 150);
                }
            });

            if (CONFIG.debugMode && changed) {
                console.log(`[情绪插件] 已尝试切换表情为: ${emotion} (路径: ${imagePath})`);
            }
        } catch (err) {
            if (CONFIG.debugMode) console.error('[情绪插件] 切换表情时出错:', err);
        }
    }

    // 可选：在SillyTavern环境中注册插件（如果ST有插件系统）
    // 注意：很多版本的ST没有这个函数，所以这里只是尝试，不影响主要功能
    if (typeof window.registerPlugin === 'function') {
        window.registerPlugin({
            name: 'localEmotionSwitcher', // 修正：直接使用字符串，而非未定义的变量
            init: initializePlugin
        });
    }
    
})();