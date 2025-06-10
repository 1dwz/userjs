(function() {
    'use strict';

    // ==================== 配置中心 ====================
    const SCRIPT_NAME = "全功能智能助手";    // 脚本名称
    const CHECK_INTERVAL = 2000;           // 检查频率（2秒），以快速响应
    const VERIFICATION_TIMEOUT = 5000;     // 错误恢复的验证时间
    const TEXT_TO_TYPE = "继续";           // 备用方案的输入文本

    // --- 优先级1: 主动操作配置 ---
    const PROACTIVE_ACTIONS = [
        {
            name: "Accept Suggestion",
            type: 'regex',
            value: /^Accept.*⏎$/,
            target: 'span'
        },
        {
            name: "Resume Conversation",
            type: 'text',
            value: "resume the conversation",
            target: 'a, span'
        }
    ];

    // --- 优先级2: 错误恢复配置 ---
    const ERROR_SCENARIOS = [
        {
            name: "Model Connection Error",
            errorMessage: "We're having trouble connecting to the model provider",
            buttonText: "Resume"
        },
        {
            name: "Network Connection Error",
            errorMessage: "Connection failed",
            buttonText: "Try again"
        }
    ];
    // =================================================

    // --- 状态与工具函数 ---
    let isAttemptingRecovery = false;
    let lastActionTime = 0;
    let intervalId = null;

    /**
     * [优化] 带有样式和时间戳的日志记录器
     * @param {string} message - 日志消息
     * @param {'info'|'success'|'warn'|'error'|'debug'} type - 日志类型
     */
    function log(message, type = 'info') {
        const time = new Date().toLocaleTimeString();
        let style = 'color: #fff; background-color: #333; padding: 2px 5px; border-radius: 3px;';
        let typePrefix = `[${SCRIPT_NAME}]`;

        switch (type) {
            case 'success':
                style += 'color: #28a745; font-weight: bold;'; // 绿色
                typePrefix = `[${SCRIPT_NAME} SUCCESS]`;
                break;
            case 'warn':
                style += 'color: #ffc107;'; // 黄色
                typePrefix = `[${SCRIPT_NAME} WARN]`;
                break;
            case 'error':
                style += 'color: #dc3545; font-weight: bold;'; // 红色
                typePrefix = `[${SCRIPT_NAME} ERROR]`;
                break;
            case 'debug':
                style += 'color: #6c757d;'; // 灰色
                typePrefix = `[${SCRIPT_NAME} DEBUG]`;
                break;
        }
        console.log(`%c${typePrefix}%c ${time}: ${message}`, style, 'color: inherit;');
    }

    /**
     * 查找并执行主动操作
     * @returns {boolean} - 如果执行了操作，返回 true
     */
    function handleProactiveActions() {
        for (const action of PROACTIVE_ACTIONS) {
            const elements = document.querySelectorAll(action.target);
            if (elements.length === 0 && CHECK_INTERVAL < 5000) continue; // [优化] 如果检查频率很高，找不到元素时就不打印日志，避免刷屏

            for (const el of elements) {
                const text = el.textContent.trim();
                let match = false;
                if (action.type === 'regex' && action.value.test(text)) {
                    match = true;
                } else if (action.type === 'text' && text === action.value) {
                    match = true;
                }

                if (match) {
                    const clickableElement = el.closest('div, a, span[role="link"], [data-link]') || el;
                    if (clickableElement && typeof clickableElement.click === 'function') {
                        log(`发现并点击主动操作: "${action.name}" (文本: "${text}")`, 'success');
                        clickableElement.click();
                        return true;
                    }
                }
            }
        }
        return false;
    }

    /**
     * 查找当前活动的错误
     * @returns {object|null}
     */
    function findActiveError() {
        const allSpans = document.querySelectorAll('span');
        for (const span of allSpans) {
            for (const scenario of ERROR_SCENARIOS) {
                if (span.textContent.includes(scenario.errorMessage)) {
                    return { element: span, scenario: scenario };
                }
            }
        }
        return null;
    }

    // 执行备用方案
    function executeBackupPlan() {
        log("执行备用方案：输入并发送。", 'warn');
        const inputBox = document.querySelector('div[contenteditable="true"].aislash-editor-input');
        if (inputBox) {
            log(`正在输入框中输入: "${TEXT_TO_TYPE}"`);
            inputBox.focus();
            inputBox.innerHTML = `<p>${TEXT_TO_TYPE}</p>`;
            inputBox.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
            setTimeout(() => {
                const sendButton = document.querySelector('.anysphere-icon-button:not([data-disabled="true"]) span.codicon-arrow-up-two');
                if (sendButton) {
                    const clickableSendButton = sendButton.closest('.anysphere-icon-button');
                    if (clickableSendButton) {
                        log("找到发送按钮，正在点击...", 'success');
                        clickableSendButton.click();
                    } else {
                        log("找到了发送图标，但无法找到可点击的父按钮。", 'error');
                    }
                } else {
                    log("未找到可用的发送按钮。", 'error');
                }
            }, 500);
        } else {
            log("备用方案失败：未找到可输入的文本框。", 'error');
        }
    }

    // 主检查与操作函数
    function performCheckAndAction() {
        // [优化] 增加调试日志，方便观察脚本是否在运行
        // log('执行检查...', 'debug'); 
        // 注意：这个调试日志会刷屏，默认关闭。需要时可以取消注释。

        if (Date.now() - lastActionTime < 1000) return;

        if (isAttemptingRecovery) {
            log('正在恢复中，跳过本轮检查。', 'debug');
            return;
        }

        if (handleProactiveActions()) {
            lastActionTime = Date.now();
            return;
        }

        const activeError = findActiveError();
        if (activeError) {
            isAttemptingRecovery = true;
            lastActionTime = Date.now();
            const { element, scenario } = activeError;
            log(`检测到错误: "${scenario.name}"。开始恢复流程...`, 'warn');

            const errorContainer = element.closest('.bg-dropdown-background');
            if (!errorContainer) {
                log("未找到错误提示的容器，将直接尝试备用方案。", 'error');
                executeBackupPlan();
                isAttemptingRecovery = false;
                return;
            }

            let actionButton = null;
            const buttonsInError = errorContainer.querySelectorAll('span');
            for (const btnSpan of buttonsInError) {
                if (btnSpan.textContent.trim() === scenario.buttonText) {
                    actionButton = btnSpan.closest('div[role="button"], a, span[role="link"]'); // [优化] 查找更可靠的可点击父元素
                    break;
                }
            }

            if (actionButton && typeof actionButton.click === 'function') {
                log(`已点击 '${scenario.buttonText}'。进入 ${VERIFICATION_TIMEOUT / 1000} 秒验证期...`, 'success');
                actionButton.click();
                setTimeout(() => {
                    log("验证期结束，重新检查错误状态...");
                    if (findActiveError()) {
                        log(`初步恢复失败，错误依然存在。`, 'error');
                        executeBackupPlan();
                    } else {
                        log(`'${scenario.buttonText}' 操作成功，错误已清除。`, 'success');
                    }
                    log("恢复流程结束。");
                    isAttemptingRecovery = false;
                }, VERIFICATION_TIMEOUT);
            } else {
                log(`在错误提示中未找到 '${scenario.buttonText}' 按钮，将直接尝试备用方案。`, 'error');
                executeBackupPlan();
                isAttemptingRecovery = false;
            }
        }
    }

    // --- 启动与停止 ---
    function start() {
        if (window.stopAssistant) {
            log("脚本已在运行中。如需重启，请先运行 stopAssistant()。", 'warn');
            return;
        }
        log(`脚本已启动，每 ${CHECK_INTERVAL / 1000} 秒检查一次。`, 'success');
        intervalId = setInterval(performCheckAndAction, CHECK_INTERVAL);

        window.stopAssistant = function() {
            if (!intervalId) {
                log("脚本已经停止了。", 'warn');
                return;
            }
            clearInterval(intervalId);
            intervalId = null;
            isAttemptingRecovery = false;
            log("脚本已手动停止。", 'info');
            delete window.stopAssistant;
            console.log("%c脚本已停止。如需重新启动，请再次粘贴并运行脚本代码。", "color: #1E90FF; font-weight: bold;");
        };
        
        console.log("%c提示: 如需停止脚本，请在控制台输入 'stopAssistant()' 并按回车。", "color: #1E90FF; font-weight: bold;");
    }

    start();

})();
