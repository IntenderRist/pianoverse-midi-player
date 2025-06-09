// ==UserScript==
// @name         PianoVerse MIDI Player
// @namespace    http://tampermonkey.net/
// @version      1.0
// @description  Воспроизведение MIDI-файлов на www.pianoverse.net с визуализацией на клавишах сайта
// @author       Copilot
// @match        https://www.pianoverse.net/*
// @grant        none
// @require      https://cdn.jsdelivr.net/npm/@tonejs/midi@2.0.27/build/Midi.min.js
// ==/UserScript==

(function() {
    // --- UI ---
    const ui = document.createElement('div');
    ui.className = 'pv-midi-player-panel';
    ui.innerHTML = `
        <div class="pv-midi-header"><b>PianoVerse MIDI Player</b></div>
        <div class="pv-midi-controls">
            <label class="pv-midi-file-btn">
                <input type="file" id="midiFile" accept=".mid,.midi" hidden>
                <span>Загрузить MIDI</span>
            </label>
            <button id="playBtn" class="pv-midi-btn" disabled title="Воспроизвести"><i class="fas fa-play"></i></button>
            <button id="stopBtn" class="pv-midi-btn" disabled title="Стоп"><i class="fas fa-stop"></i></button>
        </div>
        <div class="pv-midi-row">
            <label class="pv-midi-label">Скорость</label>
            <input type="range" id="speedRange" min="0.5" max="2" step="0.01" value="1" class="pv-midi-range">
            <span id="speedVal" class="pv-midi-value">1.00x</span>
        </div>
        <div class="pv-midi-row">
            <label class="pv-midi-checkbox">
                <input type="checkbox" id="sustainToggle" checked>
                <span>Сустейн из файла</span>
            </label>
        </div>
        <div class="pv-midi-row">
            <button id="rgbBtn" class="pv-midi-btn pv-midi-rgb">🌈 RGB-перелив цвета пользователя</button>
        </div>
        <div id="midiStatus" class="pv-midi-status"></div>
    `;
    document.body.appendChild(ui);

    // --- Стилизация интерфейса под PianoVerse ---
    const style = document.createElement('style');
    style.textContent = `
    .pv-midi-player-panel {
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999;
        background: var(--color-bg, #23272e);
        border: 1px solid var(--color-border, #444);
        border-radius: 12px;
        padding: 18px 18px 12px 18px;
        box-shadow: 0 4px 24px 0 rgba(0,0,0,0.25);
        font-family: inherit;
        min-width: 280px;
        color: var(--color-white, #fff);
    }
    .pv-midi-header {
        font-size: 1.15em;
        font-weight: 600;
        margin-bottom: 10px;
        color: var(--color-accent, #cbe978);
        text-align: center;
        letter-spacing: 0.5px;
    }
    .pv-midi-controls {
        display: flex;
        gap: 8px;
        align-items: center;
        margin-bottom: 10px;
        justify-content: center;
    }
    .pv-midi-file-btn {
        background: var(--color-accent, #cbe978);
        color: #23272e;
        border-radius: 6px;
        padding: 4px 12px;
        font-size: 0.96em;
        cursor: pointer;
        border: none;
        font-weight: 500;
        transition: background 0.2s;
        margin-right: 6px;
        display: flex;
        align-items: center;
    }
    .pv-midi-file-btn:hover {
        background: #eaffb1;
    }
    .pv-midi-btn {
        background: var(--color-panel, #31343c);
        color: var(--color-accent, #cbe978);
        border: none;
        border-radius: 6px;
        padding: 6px 12px;
        font-size: 1.1em;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        display: flex;
        align-items: center;
        justify-content: center;
    }
    .pv-midi-btn:disabled {
        opacity: 0.5;
        cursor: not-allowed;
    }
    .pv-midi-btn:not(:disabled):hover {
        background: var(--color-accent, #cbe978);
        color: #23272e;
    }
    .pv-midi-rgb {
        width: 100%;
        margin-top: 4px;
        background: linear-gradient(90deg, #cbe978, #7af53d, #4fd7f7, #cbe978);
        color: #23272e;
        font-weight: 600;
        border: none;
        font-size: 1em;
        padding: 6px 0;
        transition: filter 0.2s;
        filter: brightness(0.95);
    }
    .pv-midi-rgb:hover {
        filter: brightness(1.1);
    }
    .pv-midi-row {
        margin: 8px 0 0 0;
        display: flex;
        align-items: center;
        gap: 8px;
    }
    .pv-midi-label {
        min-width: 60px;
        font-size: 0.97em;
        color: var(--color-white, #fff);
    }
    .pv-midi-range {
        flex: 1;
        accent-color: var(--color-accent, #cbe978);
    }
    .pv-midi-value {
        min-width: 48px;
        text-align: right;
        font-size: 0.96em;
        color: var(--color-accent, #cbe978);
    }
    .pv-midi-checkbox {
        display: flex;
        align-items: center;
        gap: 6px;
        font-size: 0.97em;
    }
    .pv-midi-status {
        margin-top: 10px;
        font-size: 0.93em;
        color: var(--color-accent, #cbe978);
        text-align: center;
        min-height: 1.2em;
    }
    `;
    document.head.appendChild(style);

    // --- DOM элементы ---
    const fileInput = ui.querySelector('#midiFile');
    const playBtn = ui.querySelector('#playBtn');
    const stopBtn = ui.querySelector('#stopBtn');
    const speedRange = ui.querySelector('#speedRange');
    const speedVal = ui.querySelector('#speedVal');
    const midiStatus = ui.querySelector('#midiStatus');
    const sustainToggle = ui.querySelector('#sustainToggle');
    const rgbBtn = ui.querySelector('#rgbBtn');

    // --- Перетаскивание окна ---
    const header = ui.querySelector('.pv-midi-header');
    let dragOffsetX = 0, dragOffsetY = 0, dragging = false;
    header.addEventListener('mousedown', function(e) {
        dragging = true;
        dragOffsetX = e.clientX - ui.getBoundingClientRect().left;
        dragOffsetY = e.clientY - ui.getBoundingClientRect().top;
        document.body.style.userSelect = 'none';
    });
    document.addEventListener('mousemove', function(e) {
        if (!dragging) return;
        ui.style.left = (e.clientX - dragOffsetX) + 'px';
        ui.style.top = (e.clientY - dragOffsetY) + 'px';
        ui.style.right = 'auto';
        ui.style.position = 'fixed';
    });
    document.addEventListener('mouseup', function() {
        dragging = false;
        document.body.style.userSelect = '';
    });

    // --- Переменные ---
    let midiData = null;
    let midiEvents = [];
    let playing = false;
    let playStartTime = 0;
    let scheduledNotes = [];
    let speed = 1.0;
    let activeNotes = 0;
    let sustainSupportEnabled = true;
    let sustainState = {};
    let sustainedNotes = {};

    // --- Обработка скорости ---
    speedRange.addEventListener('input', () => {
        speed = parseFloat(speedRange.value);
        speedVal.textContent = speed.toFixed(2) + 'x';
    });

    // --- Обработка сустейна ---
    sustainToggle.addEventListener('change', () => {
        sustainSupportEnabled = sustainToggle.checked;
        if (!sustainSupportEnabled) {
            for (const ch in sustainedNotes) {
                sustainedNotes[ch].forEach(note => releasePianoKey(note));
                sustainedNotes[ch].clear();
            }
            sustainState = {};
        }
    });

    // --- Загрузка и парсинг MIDI ---
    fileInput.addEventListener('change', async e => {
        const file = e.target.files[0];
        if (!file) return;
        midiStatus.textContent = 'Загрузка...';
        const reader = new FileReader();
        reader.onload = async function(ev) {
            try {
                const midi = new Midi(ev.target.result);
                midiData = midi;
                midiEvents = extractMidiEvents(midi);
                midiStatus.textContent = `Загружено событий: ${midiEvents.length}`;
                playBtn.disabled = false;
                stopBtn.disabled = true;
                // Сбросить сустейн-состояния при загрузке нового файла
                sustainState = {};
                sustainedNotes = {};
            } catch (err) {
                midiStatus.textContent = 'Ошибка загрузки MIDI: ' + err;
            }
        };
        reader.readAsArrayBuffer(file);
    });

    // --- Кнопка RGB-переливающегося цвета пользователя ---
    let rgbUserInterval = null;
    let rgbActive = false;

    rgbBtn.onclick = () => {
        if (rgbActive) {
            clearInterval(rgbUserInterval);
            rgbUserInterval = null;
            rgbActive = false;
            rgbBtn.textContent = '🌈 RGB-перелив цвета пользователя';
            stopUserRGB();
        } else {
            rgbActive = true;
            rgbBtn.textContent = '⏹️ Остановить RGB-перелив';
            startUserRGB();
        }
    };

    function openProfilePopupIfNeeded() {
        // Попробуем найти popup профиля
        let popup = document.querySelector('pv-profile dialog.popup[open]');
        if (popup) return true;
        // Если не найден, пробуем кликнуть по иконке пользователя
        // Обычно это pv-user с вашим id или классом open
        let userIcon = document.querySelector('pv-user.open, pv-user.me, pv-user');
        if (userIcon) {
            userIcon.click();
            // Ждем появления popup (асинхронно)
            return false;
        }
        return false;
    }

    function startUserRGB() {
        stopUserRGB();
        let hue = 0;
        let popupOpened = false;
        rgbUserInterval = setInterval(() => {
            // Открываем popup, если он еще не открыт
            if (!popupOpened) {
                popupOpened = openProfilePopupIfNeeded();
                return;
            }
            hue = (hue + 2) % 360;
            const rgb = hslToRgb(hue, 90, 60);
            const hex = rgbToHex(rgb[0], rgb[1], rgb[2]);
            // Меняем цвет в popup профиля
            const colorInput = document.querySelector('pv-profile .input-color');
            const colorTextInput = document.querySelector('pv-profile .input-color-text');
            if (colorInput && colorTextInput) {
                colorInput.value = hex;
                colorTextInput.value = hex;
                colorInput.dispatchEvent(new Event('input', {bubbles:true}));
                colorTextInput.dispatchEvent(new Event('input', {bubbles:true}));
            }
            // Кликаем "Save" для применения цвета
            const saveBtn = document.querySelector('pv-profile .button-save');
            if (saveBtn) saveBtn.click();
        }, 80);
    }

    function stopUserRGB() {
        clearInterval(rgbUserInterval);
        rgbUserInterval = null;
    }
    function hslToRgb(h, s, l) {
        s /= 100; l /= 100;
        const k = n => (n + h / 30) % 12;
        const a = s * Math.min(l, 1 - l);
        const f = n => l - a * Math.max(-1, Math.min(Math.min(k(n) - 3, 9 - k(n)), 1));
        return [Math.round(255 * f(0)), Math.round(255 * f(8)), Math.round(255 * f(4))];
    }
    function rgbToHex(r, g, b) {
        return (
            '#' +
            [r, g, b]
                .map(x => {
                    const hex = x.toString(16);
                    return hex.length === 1 ? '0' + hex : hex;
                })
                .join('')
        );
    }

    // --- Отключение звука сайта на время проигрывания ---
    function muteSiteAudio(mute) {
        document.querySelectorAll('audio,video').forEach(el => {
            el.muted = mute;
        });
    }

    // --- Воспроизведение ---
    playBtn.onclick = () => {
        if (!midiEvents.length || playing) return;
        // Сбросить сустейн-состояния перед каждым воспроизведением
        sustainState = {};
        sustainedNotes = {};
        playing = true;
        playBtn.disabled = true;
        stopBtn.disabled = false;
        midiStatus.textContent = 'Воспроизведение...';
        playStartTime = performance.now();
        scheduledNotes = [];
        activeNotes = 0;
        muteSiteAudio(true);
        scheduleMidiPlayback();
    };

    // --- Остановка ---
    stopBtn.onclick = stopPlayback;

    function stopPlayback() {
        playing = false;
        playBtn.disabled = false;
        stopBtn.disabled = true;
        midiStatus.textContent = 'Остановлено.';
        scheduledNotes.forEach(id => clearTimeout(id));
        scheduledNotes = [];
        releaseAllKeys();
        for (const ch in sustainedNotes) {
            sustainedNotes[ch].clear();
        }
        sustainState = {};
        muteSiteAudio(false);
    }

    // --- Парсинг событий MIDI ---
    function extractMidiEvents(midiObj) {
        let events = [];
        midiObj.tracks.forEach(track => {
            track.notes.forEach(note => {
                const velocity = Math.round(note.velocity * 127);
                if (velocity > 0) {
                    events.push({
                        time: note.time * 1000,
                        type: 'noteOn',
                        note: note.midi,
                        velocity: velocity,
                        channel: note.channel ?? 0
                    });
                }
                events.push({
                    time: (note.time + note.duration) * 1000,
                    type: 'noteOff',
                    note: note.midi,
                    velocity: 0,
                    channel: note.channel ?? 0
                });
            });
            if (track.controlChanges && track.controlChanges[64]) {
                track.controlChanges[64].forEach(cc => {
                    events.push({
                        time: cc.time * 1000,
                        type: 'cc',
                        controller: 64,
                        value: cc.value,
                        channel: cc.channel ?? 0
                    });
                });
            }
        });
        events.sort((a, b) => a.time - b.time);
        return events;
    }

    // --- Воспроизведение событий ---
    function scheduleMidiPlayback() {
        if (!playing) return;
        let now = performance.now();
        activeNotes = 0;
        sustainState = {};
        sustainedNotes = {};
        for (let i = 0; i < midiEvents.length; i++) {
            const ev = midiEvents[i];
            const delay = (ev.time / speed) - (now - playStartTime);
            if (delay < 0) continue;
            activeNotes++;
            let id = setTimeout(() => {
                if (!playing) return;
                const ch = ev.channel ?? 0;
                if (ev.type === 'noteOn') {
                    if (ev.velocity <= 0) {
                        activeNotes--;
                        return;
                    }
                    if (sustainedNotes[ch] && sustainedNotes[ch].has(ev.note)) {
                        releasePianoKey(ev.note);
                        sustainedNotes[ch].delete(ev.note);
                    }
                    pressPianoKey(ev.note, ev.velocity);
                } else if (ev.type === 'noteOff') {
                    if (sustainSupportEnabled && sustainState[ch]) {
                        if (!sustainedNotes[ch]) sustainedNotes[ch] = new Set();
                        sustainedNotes[ch].add(ev.note);
                    } else {
                        releasePianoKey(ev.note);
                    }
                } else if (ev.type === 'cc' && ev.controller === 64 && sustainSupportEnabled) {
                    const wasOn = !!sustainState[ch];
                    sustainState[ch] = ev.value >= 0.5;
                    if (wasOn && !sustainState[ch]) {
                        if (sustainedNotes[ch]) {
                            sustainedNotes[ch].forEach(note => releasePianoKey(note));
                            sustainedNotes[ch].clear();
                        }
                    }
                }
                activeNotes--;
                if (activeNotes === 0) {
                    stopPlayback();
                }
            }, delay);
            scheduledNotes.push(id);
        }
        if (activeNotes === 0) {
            stopBtn.disabled = true;
            playBtn.disabled = false;
        }
    }

    // --- Взаимодействие с клавишами PianoVerse ---
    // Восстанавливаем эмуляцию клика мыши для проигрывания нот
    function pressPianoKey(midiNote, velocity = 127) {
        const keyEl = findPianoKeyElement(midiNote);
        if (keyEl) {
            keyEl.classList.add('copilot-midi-active');
            keyEl.style.setProperty('--copilot-vel', (velocity / 127).toFixed(2));
            keyEl.style.background = `rgba(255,200,50,${0.2 + 0.6 * (velocity / 127)})`;
            // Эмулируем нажатие мыши для проигрывания звука
            keyEl.dispatchEvent(new MouseEvent('mousedown', {bubbles:true}));
        }
    }
    function releasePianoKey(midiNote) {
        const keyEl = findPianoKeyElement(midiNote);
        if (keyEl) {
            keyEl.classList.remove('copilot-midi-active');
            keyEl.style.background = '';
            // Эмулируем отпускание мыши
            keyEl.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
        }
    }
    function releaseAllKeys() {
        document.querySelectorAll('.copilot-midi-active').forEach(el => {
            el.classList.remove('copilot-midi-active');
            el.style.background = '';
            el.dispatchEvent(new MouseEvent('mouseup', {bubbles:true}));
        });
    }
    function findPianoKeyElement(midiNote) {
        return document.querySelector(`[data-note="${midiNote}"], [data-key="${midiNote}"]`);
    }
})();