// 提醒设置相关函数，适配exam页面

function addReminder() {
    var table = document.getElementById('reminderTable');
    var row = table.insertRow(table.rows.length - 1);
    row.innerHTML = `
        <td>
            <select class="reminder-select">
                <option value="beforeStart">当距离考试开始时间还有</option>
                <option value="beforeEnd">当距离考试结束时间还有</option>
                <option value="afterEnd">当考试结束后</option>
                <option value="start">当考试开始时</option>
                <option value="end">当考试结束时</option>
                <option value="atTime">当指定时间时</option>
            </select>
        </td>
        <td>
            <input type="number" class="reminder-time-input" placeholder="分钟">
        </td>
        <td>
            <select name="audioSelect" class="reminder-select"></select>
        </td>
        <td><button class="reminder-btn" onclick="removeReminder(this)">移除提醒</button></td>
    `;
    // 监听类型切换
    row.cells[0].querySelector('select').addEventListener('change', function() {
        var inputCell = row.cells[1];
        var selectVal = this.value;
        if (selectVal === 'start' || selectVal === 'end') {
            inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="-" disabled>`;
        } else if (selectVal === 'atTime') {
            inputCell.innerHTML = `<input type="datetime-local" class="reminder-time-input" placeholder="时间">`;
        } else {
            inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="分钟">`;
        }
    });
    // 音频选项填充（含不可用标记）
    fetch('audio_files.json')
        .then(response => response.json())
        .then(audioFiles => {
            const select = row.cells[2].querySelector('select');
            Object.keys(audioFiles).forEach(type => {
                var option = document.createElement('option');
                option.value = type;
                // 检查可用性
                var audio = new Audio(audioFiles[type]);
                var unavailable = false;
                audio.addEventListener('error', function() {
                    unavailable = true;
                    option.textContent = type + '（不可用）';
                });
                audio.load();
                option.textContent = type;
                if (!audioFiles[type]) {
                    option.textContent = type + '（不可用）';
                }
                select.appendChild(option);
            });
        });
}

function removeReminder(button) {
    var row = button.parentNode.parentNode;
    row.parentNode.removeChild(row);
}

function saveConfig() {
    try {
        var table = document.getElementById('reminderTable');
        var reminders = [];
        for (var i = 1; i < table.rows.length - 1; i++) {
            var row = table.rows[i];
            var condition = row.cells[0].querySelector('select').value;
            var timeInput = row.cells[1].querySelector('input');
            var audioSelect = row.cells[2].querySelector('select');
            if (timeInput && audioSelect) {
                let timeVal;
                if (condition === 'atTime') {
                    // 存储为 yyyy-mm-ddThh:mm:ss
                    let dt = timeInput.value;
                    if (dt) {
                        let d = new Date(dt);
                        timeVal = d.getFullYear() + '-' +
                            String(d.getMonth() + 1).padStart(2, '0') + '-' +
                            String(d.getDate()).padStart(2, '0') + 'T' +
                            String(d.getHours()).padStart(2, '0') + ':' +
                            String(d.getMinutes()).padStart(2, '0') + ':' +
                            String(d.getSeconds()).padStart(2, '0');
                    } else {
                        timeVal = '';
                    }
                } else {
                    timeVal = timeInput.value || 0;
                }
                reminders.push({
                    condition: condition,
                    time: timeVal,
                    audio: audioSelect.value
                });
            }
        }
        if (reminders.length === 0) {
            errorSystem.show('请添加至少一个提醒策略');
            return;
        }
        // 保存到 Cookie 并更新提醒队列
        setCookie("examReminders", encodeURIComponent(JSON.stringify(reminders)), 365);
        loadRemindersToQueue(reminders);
        errorSystem.show('提醒设置已保存');
    } catch (e) {
        errorSystem.show('保存设置失败: ' + e.message);
    }
}

function loadRemindersToQueue(reminders) {
    // 获取当前或下一个考试
    const examConfig = window.examConfigData;
    if (!examConfig || !Array.isArray(examConfig.examInfos)) return;
    const now = Date.now();
    let targetExam = null;
    for (const exam of examConfig.examInfos) {
        const start = new Date(exam.start).getTime();
        const end = new Date(exam.end).getTime();
        if (now < end) {
            targetExam = exam;
            break;
        }
    }
    if (!targetExam) return;
    reminders.forEach(function(reminder) {
        let reminderTime;
        switch (reminder.condition) {
            case 'beforeStart':
                reminderTime = new Date(targetExam.start).getTime() - reminder.time * 60000;
                break;
            case 'beforeEnd':
                reminderTime = new Date(targetExam.end).getTime() - reminder.time * 60000;
                break;
            case 'afterEnd':
                reminderTime = new Date(targetExam.end).getTime() + reminder.time * 60000;
                break;
            case 'start':
                reminderTime = new Date(targetExam.start).getTime();
                break;
            case 'end':
                reminderTime = new Date(targetExam.end).getTime();
                break;
            case 'atTime':
                // 解析 yyyy-mm-ddThh:mm:ss
                if (reminder.time) {
                    reminderTime = new Date(reminder.time).getTime();
                }
                break;
        }
        if (reminderTime > now) {
            reminderQueue.addReminder({ time: reminderTime, condition: reminder.condition, audio: reminder.audio });
        }
    });
}

function exportConfig() {
    try {
        // 获取考试配置
        let config = null;
        if (window.examConfigData) {
            config = JSON.parse(JSON.stringify(window.examConfigData));
        } else {
            errorSystem.show('未找到考试配置信息');
            return;
        }
        // 获取提醒设置
        const reminderCookie = getCookie("examReminders");
        let reminders = [];
        if (reminderCookie) {
            reminders = JSON.parse(decodeURIComponent(reminderCookie));
        }
        config.examReminders = reminders;
        // 导出为JSON文件
        const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = "exam_config_with_reminders.json";
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        errorSystem.show('配置已导出');
    } catch (e) {
        errorSystem.show('导出配置失败: ' + e.message);
    }
}

// 校验函数，供关闭弹窗和保存时调用
function validateReminders() {
    var table = document.getElementById('reminderTable');
    for (var i = 1; i < table.rows.length - 1; i++) {
        var row = table.rows[i];
        var condition = row.cells[0].querySelector('select').value;
        var timeInput = row.cells[1].querySelector('input');
        if (condition === 'beforeStart' || condition === 'beforeEnd' || condition === 'afterEnd') {
            if (!timeInput.value || isNaN(timeInput.value) || Number(timeInput.value) <= 0) {
                errorSystem.show('请为“距离开始/结束/考试后”类型填写有效的分钟数');
                return false;
            }
        }
        if (condition === 'atTime') {
            if (!timeInput.value) {
                errorSystem.show('请为“当指定时间时”填写时间');
                return false;
            }
        }
    }
    return true;
}

// 页面加载时自动填充提醒表格
document.addEventListener("DOMContentLoaded", () => {
    // 加载提醒设置
    const reminderCookie = getCookie("examReminders");
    if (reminderCookie) {
        const reminders = JSON.parse(decodeURIComponent(reminderCookie));
        if (Array.isArray(reminders)) {
            var table = document.getElementById('reminderTable');
            while (table.rows.length > 2) {
                table.deleteRow(1);
            }
            fetch('audio_files.json')
                .then(response => response.json())
                .then(audioFiles => {
                    const validAudioTypes = Object.keys(audioFiles);
                    const defaultAudio = validAudioTypes[0];
                    reminders.forEach(function(reminder) {
                        if (!validAudioTypes.includes(reminder.audio)) {
                            reminder.audio = defaultAudio;
                        }
                        var row = table.insertRow(table.rows.length - 1);
                        let audioOptions = validAudioTypes
                            .map(audio => {
                                // 检查可用性
                                let text = audio;
                                var audioObj = new Audio(audioFiles[audio]);
                                audioObj.addEventListener('error', function() {
                                    text = audio + '（不可用）';
                                });
                                audioObj.load();
                                if (!audioFiles[audio]) text = audio + '（不可用）';
                                return `<option value="${audio}" ${reminder.audio === audio ? 'selected' : ''}>${text}</option>`;
                            })
                            .join('');
                        // 新增：atTime类型
                        let inputHtml;
                        if (reminder.condition === 'start' || reminder.condition === 'end') {
                            inputHtml = `<input type="number" class="reminder-time-input" value="" placeholder="-" disabled>`;
                        } else if (reminder.condition === 'atTime') {
                            // 还原为datetime-local
                            let dtVal = '';
                            if (reminder.time) {
                                // yyyy-mm-ddThh:mm:ss -> yyyy-mm-ddThh:mm
                                dtVal = reminder.time.substring(0, 16);
                            }
                            inputHtml = `<input type="datetime-local" class="reminder-time-input" value="${dtVal}" placeholder="时间">`;
                        } else {
                            inputHtml = `<input type="number" class="reminder-time-input" value="${reminder.time}" placeholder="分钟">`;
                        }
                        row.innerHTML = `
                            <td>
                                <select class="reminder-select">
                                    <option value="beforeStart" ${reminder.condition === 'beforeStart' ? 'selected' : ''}>当距离考试开始时间还有</option>
                                    <option value="beforeEnd" ${reminder.condition === 'beforeEnd' ? 'selected' : ''}>当距离考试结束时间还有</option>
                                    <option value="afterEnd" ${reminder.condition === 'afterEnd' ? 'selected' : ''}>当考试结束后</option>
                                    <option value="start" ${reminder.condition === 'start' ? 'selected' : ''}>当考试开始时</option>
                                    <option value="end" ${reminder.condition === 'end' ? 'selected' : ''}>当考试结束时</option>
                                    <option value="atTime" ${reminder.condition === 'atTime' ? 'selected' : ''}>当指定时间时</option>
                                </select>
                            </td>
                            <td>${inputHtml}</td>
                            <td>
                                <select name="audioSelect" class="reminder-select">
                                    ${audioOptions}
                                </select>
                            </td>
                            <td><button class="reminder-btn" onclick="removeReminder(this)">移除提醒</button></td>
                        `;
                        row.cells[0].querySelector('select').addEventListener('change', function() {
                            let inputCell = row.cells[1];
                            let val = this.value;
                            if (val === 'start' || val === 'end') {
                                inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="-" disabled>`;
                            } else if (val === 'atTime') {
                                inputCell.innerHTML = `<input type="datetime-local" class="reminder-time-input" placeholder="时间">`;
                            } else {
                                inputCell.innerHTML = `<input type="number" class="reminder-time-input" placeholder="分钟">`;
                            }
                        });
                    });
                    loadRemindersToQueue(reminders);
                });
        }
    }
});
