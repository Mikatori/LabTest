console.log("EnviroLab Sim: Titration Module Loaded.");

// ==========================================
// CONFIGURATION & CONSTANTS
// ==========================================
const C = {
    SAMPLE_VOL: 10, // mL
    CONC_HCL: 0.1,  // M
    CONC_NAOH: 0.1, // M
    INDICATOR_PH: 8.2
};

// ==========================================
// GAME STATE
// ==========================================
const state = {
    objects: {
        flask: null,  // { id, el, hasSample, hasIndicator, liquidVol, ph }
        burette: null // { id, el, volRemaining, isOpen }
    },
    isDragging: false,
    dragType: null,
    totalTitrantAdded: 0
};

// ==========================================
// DOM ELEMENTS
// ==========================================
const bench = document.getElementById('lab-bench');
const tools = document.querySelectorAll('.tool-item');
const statusLog = document.getElementById('status-log');
const volReadout = document.getElementById('vol-readout');
const phReadout = document.getElementById('ph-readout');
const resetBtn = document.getElementById('reset-btn');

// ==========================================
// UTILITIES
// ==========================================
function log(msg) {
    const p = document.createElement('div');
    p.textContent = `> ${msg}`;
    p.style.marginBottom = '4px';
    statusLog.appendChild(p);
    statusLog.scrollTop = statusLog.scrollHeight;
}

function updateReadouts() {
    volReadout.textContent = state.totalTitrantAdded.toFixed(2) + ' mL';

    // Calculate simple pH
    // If no sample, pH is neutral (7) or undefined
    if (!state.objects.flask || !state.objects.flask.hasSample) {
        phReadout.textContent = "--";
        return;
    }

    // Moles calculation
    const molesAcid = (C.SAMPLE_VOL / 1000) * C.CONC_HCL;
    const molesBase = (state.totalTitrantAdded / 1000) * C.CONC_NAOH;
    const totalVolL = (C.SAMPLE_VOL + state.totalTitrantAdded) / 1000;

    let ph = 7;
    if (molesAcid > molesBase) {
        const excessAcid = molesAcid - molesBase;
        const hConc = excessAcid / totalVolL;
        ph = -Math.log10(hConc);
    } else if (molesBase > molesAcid) {
        const excessBase = molesBase - molesAcid;
        const ohConc = excessBase / totalVolL;
        const pOH = -Math.log10(ohConc);
        ph = 14 - pOH;
    } else {
        ph = 7;
    }

    phReadout.textContent = ph.toFixed(2);
    updateFlaskColor(ph);
}

function updateFlaskColor(ph) {
    if (!state.objects.flask || !state.objects.flask.hasIndicator) return;

    const liquid = state.objects.flask.el.querySelector('.liquid');

    // Phenolphthalein: Clear < 8.2, Pink >= 8.2
    if (ph < 8.2) {
        liquid.style.background = 'rgba(255, 255, 255, 0.5)'; // Clear-ish
    } else {
        // Calculate intensity based on how far past 8.2
        let intensity = Math.min((ph - 8.2) * 2, 1);
        liquid.style.background = `rgba(255, 0, 127, ${0.2 + intensity * 0.6})`;
    }
}

// ==========================================
// INTERACTION LOGIC
// ==========================================

// Drag Start
tools.forEach(tool => {
    tool.addEventListener('dragstart', (e) => {
        state.isDragging = true;
        state.dragType = tool.dataset.type;
        e.dataTransfer.setData('type', state.dragType);
    });

    tool.addEventListener('dragend', () => {
        state.isDragging = false;
        state.dragType = null;
    });
});

// Drop Zone
bench.addEventListener('dragover', (e) => {
    e.preventDefault(); // Allow drop
});

bench.addEventListener('drop', (e) => {
    e.preventDefault();
    const type = e.dataTransfer.getData('type');
    const rect = bench.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    handleDrop(type, x, y);
});

function handleDrop(type, x, y) {
    console.log("Dropped:", type, "at", x, y); // Debug log

    // 1. SETUP: Place Flask
    if (type === 'flask') {
        if (state.objects.flask) {
            log("Đã có bình tam giác trên bàn.");
            return;
        }
        createFlask(x, y);
        log("Đã đặt bình tam giác.");
    }
    // 1b. SETUP: Place Beaker (Added)
    else if (type === 'beaker') {
        if (state.objects.flask) { // Reuse flask slot for simplicity in v1
            log("Bàn thí nghiệm đã có dụng cụ.");
            return;
        }
        // Ideally createBeaker, but for titration we need flask.
        // Let's allow placing it but warn the user for this specific experiment.
        createBeaker(x, y);
        log("Đã đặt cốc Beaker. (Lưu ý: Thí nghiệm Chuẩn độ thường dùng Bình tam giác)");
    }
    // 2. SETUP: Place Burette
    else if (type === 'burette') {
        if (!state.objects.flask) {
            log("Cần đặt bình tam giác trước khi lắp Burette!");
            return;
        }
        if (state.objects.burette) {
            log("Burette đã được lắp.");
            return;
        }
        createBurette();
        log("Đã lắp Burette và nạp đầy NaOH.");
    }
    // 3. ACTION: Add Sample (HCl)
    else if (type === 'chem-hcl') {
        if (state.objects.flask) {
            if (state.objects.flask.hasSample) {
                log("Đã có mẫu trong bình.");
            } else {
                state.objects.flask.hasSample = true;
                state.objects.flask.liquidVol += 10;
                updateLiquidVisuals();
                log("Đã lấy 10ml mẫu HCl vào bình.");
                updateReadouts(); // Update pH start
            }
        }
    }
    // 4. ACTION: Add Indicator
    else if (type === 'chem-indicator') {
        if (state.objects.flask && state.objects.flask.hasSample) {
            if (state.objects.flask.hasIndicator) {
                log("Đã có chỉ thị màu.");
            } else {
                state.objects.flask.hasIndicator = true;
                log("Đã nhỏ 3 giọt Phenolphthalein.");
                updateReadouts(); // Just in case pH is already high (unlikely for HCl)
            }
        } else {
            log("Cần có mẫu nước trong bình trước.");
        }
    }
    // Default fallback
    else {
        log(`Không thể đặt ${type} vào lúc này.`);
    }
}

// ==========================================
// OBJECT CREATION
// ==========================================
function createBeaker(x, y) {
    const el = document.createElement('div');
    el.className = 'sim-object beaker-container';
    el.style.left = 'calc(50% - 40px)';
    el.style.top = 'calc(50% - 20px)';

    el.innerHTML = `
        <div class="beaker-body">
            <div class="liquid" style="height: 0%"></div>
        </div>
    `;

    bench.appendChild(el);
    // Treat it as the main vessel for now so chemicals can be added
    state.objects.flask = {
        el: el,
        hasSample: false,
        hasIndicator: false,
        liquidVol: 0
    };
}

function createFlask(x, y) {
    const el = document.createElement('div');
    el.className = 'sim-object flask-container';
    // Center it roughly
    el.style.left = 'calc(50% - 50px)';
    el.style.top = 'calc(50% - 40px)'; // Fixed position for easier alignment in V1

    el.innerHTML = `
        <div class="flask-neck"></div>
        <div class="flask-body">
            <div class="liquid" style="height: 0%"></div>
        </div>
    `;

    bench.appendChild(el);
    state.objects.flask = {
        el: el,
        hasSample: false,
        hasIndicator: false,
        liquidVol: 0
    };
}

function updateLiquidVisuals() {
    const flask = state.objects.flask;
    if (!flask) return;
    const liquid = flask.el.querySelector('.liquid');

    // 10ml = 20% height (arbitrary scale)
    // + titrant added
    const height = (flask.liquidVol + state.totalTitrantAdded) * 2;
    liquid.style.height = `${Math.min(height, 90)}%`;
}

function createBurette() {
    const flaskEl = state.objects.flask.el;

    const el = document.createElement('div');
    el.className = 'burette-container';

    el.innerHTML = `
        <div class="burette-body">
            <div class="burette-liquid"></div>
        </div>
        <div class="valve" id="burette-valve"></div>
        <div class="drop" id="burette-drop"></div>
    `;

    // Append to flask container so it moves with it or stays relative
    flaskEl.appendChild(el);

    const valve = el.querySelector('#burette-valve');
    const drop = el.querySelector('#burette-drop');

    state.objects.burette = {
        el: el,
        isOpen: false,
        interval: null
    };

    // Click valve to toggle flow
    valve.addEventListener('click', (e) => {
        e.stopPropagation();
        toggleBurette(valve, drop);
    });
}

function toggleBurette(valveEl, dropEl) {
    const b = state.objects.burette;
    b.isOpen = !b.isOpen;

    if (b.isOpen) {
        valveEl.classList.add('open');
        dropEl.classList.add('animating');
        log("Mở khóa Burette. Đang nhỏ NaOH...");

        b.interval = setInterval(() => {
            // Add titrant
            state.totalTitrantAdded += 0.1; // 0.1 mL per tick
            updateLiquidVisuals();
            updateReadouts();
        }, 200); // Speed of titration
    } else {
        valveEl.classList.remove('open');
        dropEl.classList.remove('animating');
        log("Đã khóa Burette.");
        clearInterval(b.interval);
    }
}

// ==========================================
// RESET
// ==========================================
resetBtn.addEventListener('click', () => {
    bench.innerHTML = '<div class="placeholder-text">Kéo dụng cụ vào đây để bắt đầu thí nghiệm</div>';
    state.objects.flask = null;
    state.objects.burette = null;
    state.totalTitrantAdded = 0;
    volReadout.textContent = "0.00 mL";
    phReadout.textContent = "--";
    log("--- Đã làm mới ---");
});
