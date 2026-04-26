// ─── modal ────────────────────────────────────────────────────

const modalOverlay: HTMLElement | null = document.getElementById('modal-overlay');

document.getElementById('about-btn')?.addEventListener('click', () => {
  modalOverlay?.classList.remove('hidden');
});

document.getElementById('modal-close')?.addEventListener('click', () => {
  modalOverlay?.classList.add('hidden');
});

modalOverlay?.addEventListener('click', (e) => {
  if (e.target === modalOverlay) modalOverlay?.classList.add('hidden');
});

document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape') return;
  modalOverlay?.classList.add('hidden');
  document.querySelectorAll('.panel--fullscreen')
    .forEach((p) => p.classList.remove('panel--fullscreen'));
});

// ─── run / stop toggle ────────────────────────────────────────

const runBtn = document.getElementById('run-btn');

runBtn?.addEventListener('click', () => {
  const running = runBtn.classList.toggle('is-running');
  runBtn.innerHTML = running ? '■&nbsp;STOP' : '▶&nbsp;RUN';
});

// ─── preset buttons ───────────────────────────────────────────

const presetBtns = document.querySelectorAll('.preset-btn');

presetBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    presetBtns.forEach((b) => b.classList.remove('active'));
    btn.classList.add('active');
  });
});

// ─── panel fullscreen ─────────────────────────────────────────

document.querySelectorAll('.dot-green').forEach((dot) => {
  dot.addEventListener('click', () => {
    const panel = dot.closest('.editor-panel, .console-panel, .canvas-panel');
    if (panel) panel.classList.toggle('panel--fullscreen');
  });
});

// ─── panel minimise / remove ──────────────────────────────────

const workspace: HTMLElement | null = document.querySelector('.workspace');
const leftPanel: HTMLElement | null = document.querySelector('.left-panel');
const editorPanel: HTMLElement | null = document.querySelector('.editor-panel');
const consolePanel: HTMLElement | null = document.querySelector('.console-panel');
const canvasPanel: HTMLElement | null = document.querySelector('.canvas-panel');
const closedList: HTMLElement | null = document.getElementById('closed-list');
const sidebarClosed: HTMLElement | null = document.getElementById('sidebar-closed');

function updateWorkspaceLayout() {
  const editorMin   = editorPanel?.classList.contains('panel--minimised');
  const editorGone  = editorPanel?.classList.contains('panel--removed');
  const consoleMin  = consolePanel?.classList.contains('panel--minimised');
  const consoleGone = consolePanel?.classList.contains('panel--removed');
  const canvasMin   = canvasPanel?.classList.contains('panel--minimised');
  const canvasGone  = canvasPanel?.classList.contains('panel--removed');

  const leftEmpty  = editorGone  && consoleGone;
  const leftStrip  = !leftEmpty  && (editorMin  || editorGone)  && (consoleMin  || consoleGone);
  const rightEmpty = canvasGone;
  const rightStrip = !rightEmpty && canvasMin;

  workspace?.classList.toggle('workspace--left-empty', leftEmpty);
  workspace?.classList.toggle('workspace--left-collapsed', !leftEmpty && leftStrip);
  workspace?.classList.toggle('workspace--right-empty', rightEmpty);
  workspace?.classList.toggle('workspace--right-collapsed', rightStrip && !leftEmpty);

  // clear inline resize so CSS layout classes (and full-width expansion) can take effect
  if (leftEmpty  || leftStrip  || rightEmpty) leftPanel && (leftPanel.style.flex = '');
  if (rightEmpty || rightStrip || leftEmpty) canvasPanel && (canvasPanel.style.flex = '');
}

document.querySelectorAll('.dot-amber').forEach((dot) => {
  dot.addEventListener('click', () => {
    const panel = dot.closest('.editor-panel, .console-panel, .canvas-panel');
    if (!panel) return;
    panel.classList.toggle('panel--minimised');
    updateWorkspaceLayout();
  });
});

document.querySelectorAll('.dot-red').forEach((dot) => {
  dot.addEventListener('click', () => {
    const panel = dot.closest('.editor-panel, .console-panel, .canvas-panel');
    if (!panel) return;

    panel.classList.remove('panel--minimised', 'panel--fullscreen');
    panel.classList.add('panel--removed');

    const name = panel?.querySelector('.panel-title')?.textContent?.trim() || ''
    const btn  = document.createElement('button');
    btn.className   = 'restore-btn';
    btn.textContent = name;
    btn.addEventListener('click', () => {
      panel.classList.remove('panel--removed');
      btn.remove();
      // @ts-ignore
      sidebarClosed?.classList.toggle('has-items', closedList.children.length > 0);
      updateWorkspaceLayout();
    });

    closedList?.appendChild(btn);
    sidebarClosed?.classList.add('has-items');
    updateWorkspaceLayout();
  });
});

// ─── column resize (left ↔ right) ────────────────────────────

const colHandle = document.getElementById('col-resize');

colHandle?.addEventListener('mousedown', (e) => {
  if (workspace?.className.split(' ').some((c) => c.startsWith('workspace--'))) return;

  e.preventDefault();
  const startX  = e.clientX;
  const startW  = leftPanel?.getBoundingClientRect().width || 0;
  const minW    = 160;

  colHandle.classList.add('is-dragging');
  document.body.style.cursor    = 'ew-resize';
  document.body.style.userSelect = 'none';

  function onMove(e: MouseEvent) {
    const totalW = (workspace?.getBoundingClientRect().width || 0) - (colHandle?.offsetWidth || 0);
    const newW   = Math.min(totalW - minW, Math.max(minW, startW + (e.clientX - startX)));
    if (leftPanel) leftPanel.style.flex = `0 0 ${newW}px`;
  }

  function onUp() {
    colHandle?.classList.remove('is-dragging');
    document.body.style.cursor    = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
});

// ─── row resize (editor ↕ console) ───────────────────────────

const rowHandle = document.getElementById('row-resize');

rowHandle?.addEventListener('mousedown', (e) => {
  const blocked =
    editorPanel?.classList.contains('panel--minimised')  ||
    editorPanel?.classList.contains('panel--removed')    ||
    consolePanel?.classList.contains('panel--minimised') ||
    consolePanel?.classList.contains('panel--removed');
  if (blocked) return;

  e.preventDefault();
  const startY  = e.clientY;
  const startH  = consolePanel?.getBoundingClientRect().height || 0;
  const minH    = 48;

  rowHandle?.classList.add('is-dragging');
  document.body.style.cursor    = 'ns-resize';
  document.body.style.userSelect = 'none';

  function onMove(e: MouseEvent) {
    const totalH = (leftPanel?.getBoundingClientRect().height || 0) - (rowHandle?.offsetHeight || 0);
    const dy     = startY - e.clientY;
    const newH   = Math.min(totalH - minH, Math.max(minH, startH + dy));
    if (consolePanel) consolePanel.style.flex = `0 0 ${newH}px`;
  }

  function onUp() {
    rowHandle?.classList.remove('is-dragging');
    document.body.style.cursor    = '';
    document.body.style.userSelect = '';
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup',   onUp);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup',   onUp);
});

// ─── canvas resize ────────────────────────────────────────────

const canvas = document.getElementById('viz-canvas');

function resizeCanvas() {
  const parent = canvas?.parentElement;
  const titlebar = parent?.querySelector('.panel-titlebar');
  if (canvas && parent && titlebar) {
    // @ts-ignore
    canvas.width  = parent.clientWidth;
    // @ts-ignore
    canvas.height = parent.clientHeight - titlebar.clientHeight;
  }
}

const resizeObserver = new ResizeObserver(resizeCanvas);
if (canvas?.parentElement) {
  resizeObserver.observe(canvas.parentElement);
}
resizeCanvas();
