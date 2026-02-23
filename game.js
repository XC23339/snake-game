const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

const scoreEl = document.getElementById('score');
const timeEl = document.getElementById('time');
const statusEl = document.getElementById('status');
const leaderboardBody = document.getElementById('leaderboardBody');

const startBtn = document.getElementById('startBtn');
const pauseBtn = document.getElementById('pauseBtn');
const restartBtn = document.getElementById('restartBtn');
const difficultySelect = document.getElementById('difficultySelect');

const overlay = document.getElementById('overlay');
const overlayText = document.getElementById('overlayText');
const overlayRestartBtn = document.getElementById('overlayRestartBtn');

const GRID = 24;
const CELL = canvas.width / GRID;
const BOARD_SIZE = GRID;
const RANK_KEY = 'snakeLeaderboardV2';

const DIFFICULTY = {
  easy: { speed: 160, obstacleCount: 0, label: '简单' },
  normal: { speed: 120, obstacleCount: 0, label: '普通' },
  hard: { speed: 90, obstacleCount: 14, label: '困难' },
};

let snake = [];
let direction = { x: 1, y: 0 };
let nextDirection = { x: 1, y: 0 };
let food = { x: 10, y: 10 };
let obstacles = [];
let score = 0;
let running = false;
let paused = false;
let gameLoop = null;
let timerLoop = null;
let startTime = null;
let pausedAt = null;
let pausedTotalMs = 0;
let currentDifficulty = 'normal';

function resetState() {
  snake = [
    { x: 6, y: 12 },
    { x: 5, y: 12 },
    { x: 4, y: 12 },
  ];
  direction = { x: 1, y: 0 };
  nextDirection = { x: 1, y: 0 };
  score = 0;
  paused = false;
  pausedAt = null;
  pausedTotalMs = 0;
  scoreEl.textContent = '0';
  timeEl.textContent = '00:00';

  generateObstacles();
  spawnFood();
  draw();
}

function generateObstacles() {
  const { obstacleCount } = DIFFICULTY[currentDifficulty];
  obstacles = [];
  while (obstacles.length < obstacleCount) {
    const x = Math.floor(Math.random() * BOARD_SIZE);
    const y = Math.floor(Math.random() * BOARD_SIZE);

    const onSnake = snake.some((s) => s.x === x && s.y === y);
    const nearSpawn = x <= 8 && y >= 10 && y <= 14;
    const exists = obstacles.some((o) => o.x === x && o.y === y);

    if (!onSnake && !nearSpawn && !exists) {
      obstacles.push({ x, y });
    }
  }
}

function spawnFood() {
  while (true) {
    const x = Math.floor(Math.random() * BOARD_SIZE);
    const y = Math.floor(Math.random() * BOARD_SIZE);
    const onSnake = snake.some((s) => s.x === x && s.y === y);
    const onObstacle = obstacles.some((o) => o.x === x && o.y === y);
    if (!onSnake && !onObstacle) {
      food = { x, y };
      return;
    }
  }
}

function formatMs(ms) {
  const sec = Math.floor(ms / 1000);
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return `${m}:${s}`;
}

function elapsedMs() {
  if (!startTime) return 0;
  const now = paused && pausedAt ? pausedAt : Date.now();
  return now - startTime - pausedTotalMs;
}

function startGame() {
  currentDifficulty = difficultySelect.value;
  resetState();

  running = true;
  startTime = Date.now();

  startBtn.disabled = true;
  restartBtn.disabled = false;
  pauseBtn.disabled = false;
  pauseBtn.textContent = '暂停';
  difficultySelect.disabled = true;
  overlay.classList.add('hidden');
  statusEl.textContent = `进行中（${DIFFICULTY[currentDifficulty].label}）`;

  clearInterval(timerLoop);
  timerLoop = setInterval(() => {
    if (!running || paused) return;
    timeEl.textContent = formatMs(elapsedMs());
  }, 250);

  clearInterval(gameLoop);
  gameLoop = setInterval(tick, DIFFICULTY[currentDifficulty].speed);
}

function setPaused(flag) {
  if (!running) return;
  paused = flag;

  if (paused) {
    pausedAt = Date.now();
    statusEl.textContent = `已暂停（${DIFFICULTY[currentDifficulty].label}）`;
    pauseBtn.textContent = '继续';
  } else {
    if (pausedAt) {
      pausedTotalMs += Date.now() - pausedAt;
    }
    pausedAt = null;
    statusEl.textContent = `进行中（${DIFFICULTY[currentDifficulty].label}）`;
    pauseBtn.textContent = '暂停';
  }
}

function togglePause() {
  if (!running) return;
  setPaused(!paused);
}

function endGame(reason = '撞墙、撞到自己或撞到障碍物') {
  running = false;
  paused = false;
  clearInterval(gameLoop);
  clearInterval(timerLoop);

  pauseBtn.disabled = true;
  pauseBtn.textContent = '暂停';
  startBtn.disabled = false;
  difficultySelect.disabled = false;

  statusEl.textContent = '已结束';

  const duration = elapsedMs();
  const durationText = formatMs(duration);
  overlayText.textContent = `本局得分 ${score}，用时 ${durationText}（${reason}）`;
  overlay.classList.remove('hidden');

  saveResult(score, duration, currentDifficulty);
  renderLeaderboard();
}

function tick() {
  if (!running || paused) return;

  direction = nextDirection;
  const head = { ...snake[0] };
  head.x += direction.x;
  head.y += direction.y;

  const hitWall = head.x < 0 || head.y < 0 || head.x >= BOARD_SIZE || head.y >= BOARD_SIZE;
  const hitSelf = snake.some((s) => s.x === head.x && s.y === head.y);
  const hitObstacle = obstacles.some((o) => o.x === head.x && o.y === head.y);

  if (hitWall || hitSelf || hitObstacle) {
    endGame();
    return;
  }

  snake.unshift(head);

  if (head.x === food.x && head.y === food.y) {
    score += 10;
    scoreEl.textContent = String(score);
    spawnFood();
  } else {
    snake.pop();
  }

  draw();
}

function drawGrid() {
  ctx.strokeStyle = 'rgba(120, 146, 191, 0.12)';
  ctx.lineWidth = 1;
  for (let i = 0; i <= GRID; i++) {
    ctx.beginPath();
    ctx.moveTo(i * CELL, 0);
    ctx.lineTo(i * CELL, canvas.height);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(0, i * CELL);
    ctx.lineTo(canvas.width, i * CELL);
    ctx.stroke();
  }
}

function draw() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawGrid();

  // obstacles
  obstacles.forEach((o) => {
    ctx.fillStyle = '#64748b';
    ctx.fillRect(o.x * CELL + 2, o.y * CELL + 2, CELL - 4, CELL - 4);
  });

  // food
  ctx.fillStyle = '#fb7185';
  ctx.beginPath();
  ctx.arc(food.x * CELL + CELL / 2, food.y * CELL + CELL / 2, CELL * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // snake
  snake.forEach((part, idx) => {
    ctx.fillStyle = idx === 0 ? '#4ade80' : '#22c55e';
    ctx.fillRect(part.x * CELL + 1, part.y * CELL + 1, CELL - 2, CELL - 2);
  });
}

function saveResult(scoreVal, duration, difficulty) {
  const existing = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
  existing.push({
    score: scoreVal,
    duration,
    difficulty,
    createdAt: new Date().toLocaleString('zh-CN', { hour12: false }),
  });

  existing.sort((a, b) => b.score - a.score || a.duration - b.duration);
  const trimmed = existing.slice(0, 10);
  localStorage.setItem(RANK_KEY, JSON.stringify(trimmed));
}

function renderLeaderboard() {
  const data = JSON.parse(localStorage.getItem(RANK_KEY) || '[]');
  leaderboardBody.innerHTML = '';

  if (data.length === 0) {
    leaderboardBody.innerHTML = '<tr><td colspan="4">暂无记录，先来一局吧。</td></tr>';
    return;
  }

  data.forEach((item, index) => {
    const difficultyLabel = DIFFICULTY[item.difficulty]?.label || item.difficulty || '-';
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${index + 1}</td>
      <td>${item.score}（${difficultyLabel}）</td>
      <td>${formatMs(item.duration)}</td>
      <td>${item.createdAt}</td>
    `;
    leaderboardBody.appendChild(tr);
  });
}

window.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();

  if (key === 'p') {
    togglePause();
    return;
  }

  const map = {
    arrowup: { x: 0, y: -1 },
    w: { x: 0, y: -1 },
    arrowdown: { x: 0, y: 1 },
    s: { x: 0, y: 1 },
    arrowleft: { x: -1, y: 0 },
    a: { x: -1, y: 0 },
    arrowright: { x: 1, y: 0 },
    d: { x: 1, y: 0 },
  };

  if (!map[key] || !running || paused) return;

  const nd = map[key];
  // prevent reverse
  if (nd.x === -direction.x && nd.y === -direction.y) return;
  nextDirection = nd;
});

startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
overlayRestartBtn.addEventListener('click', startGame);
pauseBtn.addEventListener('click', togglePause);

resetState();
renderLeaderboard();
