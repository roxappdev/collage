const dropZone = document.getElementById('drop-zone');
const fileInput = document.getElementById('file-input');
const fileInput2 = document.getElementById('file-input-2');
const workspace = document.getElementById('workspace');
const canvas = document.getElementById('canvas');
const saveBtn = document.getElementById('save-btn');
const clearBtn = document.getElementById('clear-btn');
const gapSlider = document.getElementById('gap-slider');
const radiusSlider = document.getElementById('radius-slider');
const sizeSelect = document.getElementById('size-select');
const sizeCustom = document.getElementById('size-custom');

let currentImages = [];
let currentGap = 4;
let currentRadius = 8;

// --- Load images from either input ---

function loadFiles(files) {
    const fileList = Array.from(files);
    if (fileList.length === 0) return;

    const readers = fileList.map(file => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = URL.createObjectURL(file);
    }));

    Promise.all(readers).then(images => {
        currentImages = images;
        renderCollage(images);
        // Switch to workspace view
        dropZone.hidden = true;
        workspace.hidden = false;
    });
}

fileInput.addEventListener('change', (e) => {
    loadFiles(e.target.files);
    e.target.value = '';
});

fileInput2.addEventListener('change', (e) => {
    // Add to existing images
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    const readers = files.map(file => new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.src = URL.createObjectURL(file);
    }));

    Promise.all(readers).then(newImages => {
        currentImages = currentImages.concat(newImages);
        renderCollage(currentImages);
    });

    e.target.value = '';
});

// --- Drag & Drop on drop zone ---

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('drag-over');
    loadFiles(e.dataTransfer.files);
});

dropZone.addEventListener('click', () => {
    fileInput.click();
});

// --- Grid calculation ---

function calcGrid(n) {
    if (n === 1) return { cols: 1, rows: 1 };
    if (n === 2) return { cols: 2, rows: 1 };
    if (n === 3) return { cols: 3, rows: 1 };
    if (n === 4) return { cols: 2, rows: 2 };

    let best = { cols: n, rows: 1, diff: Infinity };
    for (let rows = 1; rows <= n; rows++) {
        const cols = Math.ceil(n / rows);
        const total = rows * cols;
        const diff = Math.abs(cols - rows) + (total - n) * 0.5;
        if (diff < best.diff) {
            best = { cols, rows, diff };
        }
    }
    return { cols: best.cols, rows: best.rows };
}

// --- Render ---

function renderCollage(images) {
    const n = images.length;
    const { cols, rows } = calcGrid(n);

    canvas.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    canvas.style.gridTemplateRows = `repeat(${rows}, 1fr)`;
    canvas.style.gap = `${currentGap}px`;
    canvas.innerHTML = '';

    for (let i = 0; i < n; i++) {
        const cell = document.createElement('div');
        cell.className = 'cell';
        cell.draggable = true;
        cell.dataset.index = i;

        const img = images[i].cloneNode();
        img.draggable = false;
        cell.style.borderRadius = `${currentRadius}px`;
        cell.appendChild(img);
        canvas.appendChild(cell);

        cell.addEventListener('dragstart', onDragStart);
        cell.addEventListener('dragover', onDragOver);
        cell.addEventListener('dragenter', onDragEnter);
        cell.addEventListener('dragleave', onDragLeave);
        cell.addEventListener('drop', onDrop);
        cell.addEventListener('dragend', onDragEnd);
    }

}

// --- Drag & Drop reorder ---

let dragSrcIndex = null;

function onDragStart(e) {
    dragSrcIndex = parseInt(this.dataset.index);
    this.style.opacity = '0.5';
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', '');
}

function onDragOver(e) {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
}

function onDragEnter(e) {
    e.preventDefault();
    if (this.dataset.index !== undefined) {
        this.style.outline = '3px solid #007aff';
    }
}

function onDragLeave() {
    this.style.outline = '';
}

function onDrop(e) {
    e.preventDefault();
    this.style.outline = '';
    const targetIndex = parseInt(this.dataset.index);
    if (dragSrcIndex === undefined || dragSrcIndex === targetIndex) return;

    [currentImages[dragSrcIndex], currentImages[targetIndex]] =
        [currentImages[targetIndex], currentImages[dragSrcIndex]];

    renderCollage(currentImages);
}

function onDragEnd() {
    this.style.opacity = '1';
    document.querySelectorAll('.cell').forEach(c => c.style.outline = '');
}

// --- Save ---

function drawImageCover(ctx, img, dx, dy, dw, dh) {
    const imgAspect = img.naturalWidth / img.naturalHeight;
    const boxAspect = dw / dh;

    let sx, sy, sw, sh;
    if (imgAspect > boxAspect) {
        sh = img.naturalHeight;
        sw = img.naturalHeight * boxAspect;
        sx = (img.naturalWidth - sw) / 2;
        sy = 0;
    } else {
        sw = img.naturalWidth;
        sh = img.naturalWidth / boxAspect;
        sx = 0;
        sy = (img.naturalHeight - sh) / 2;
    }

    ctx.drawImage(img, sx, sy, sw, sh, dx, dy, dw, dh);
}

saveBtn.addEventListener('click', () => {
    const cells = canvas.querySelectorAll('.cell');
    const images = canvas.querySelectorAll('.cell img');
    if (images.length === 0) return;

    const { cols, rows } = calcGrid(images.length);
    const gap = currentGap;
    const padding = 8;
    const radius = currentRadius;

    const firstCell = cells[0];
    const cellW = firstCell.offsetWidth;
    const cellH = firstCell.offsetHeight;

    const collageW = cols * cellW + (cols - 1) * gap + padding * 2;
    const collageH = rows * cellH + (rows - 1) * gap + padding * 2;

    let targetSize;
    if (sizeSelect.value === 'custom') {
        targetSize = parseInt(sizeCustom.value) || 2000;
    } else {
        targetSize = parseInt(sizeSelect.value);
    }
    const scale = targetSize / Math.max(collageW, collageH);

    const outW = Math.round(collageW * scale);
    const outH = Math.round(collageH * scale);

    const offscreen = document.createElement('canvas');
    offscreen.width = outW;
    offscreen.height = outH;
    const ctx = offscreen.getContext('2d');

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, outW, outH);

    const s = scale;
    const r = radius * s;

    images.forEach((img, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = (col * cellW + col * gap + padding) * s;
        const y = (row * cellH + row * gap + padding) * s;
        const w = cellW * s;
        const h = cellH * s;

        ctx.save();

        ctx.beginPath();
        ctx.moveTo(x + r, y);
        ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
        ctx.clip();

        drawImageCover(ctx, img, x, y, w, h);

        ctx.restore();
    });

    const link = document.createElement('a');
    link.download = 'collage.png';
    link.href = offscreen.toDataURL('image/png');
    link.click();
});

// Radius slider
radiusSlider.addEventListener('input', () => {
    currentRadius = parseInt(radiusSlider.value);
    document.querySelectorAll('.cell').forEach(c => {
        c.style.borderRadius = `${currentRadius}px`;
    });
});

// --- Controls ---

gapSlider.addEventListener('input', () => {
    currentGap = parseInt(gapSlider.value);
    canvas.style.gap = `${currentGap}px`;
});

sizeSelect.addEventListener('change', () => {
    sizeCustom.hidden = sizeSelect.value !== 'custom';
});
// Clear
clearBtn.addEventListener('click', () => {
    currentImages = [];
    canvas.innerHTML = '';
    workspace.hidden = true;
    dropZone.hidden = false;
});