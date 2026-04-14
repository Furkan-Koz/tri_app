function initHeroSlider() {
  const slider = document.getElementById("heroSlider");
  const dotsContainer = document.getElementById("heroDots");

  if (!slider || !dotsContainer) {
    return;
  }

  const slides = [...slider.querySelectorAll(".hero-slide")];
  let currentIndex = 0;
  let timerId;

  function renderDots() {
    const fragment = document.createDocumentFragment();

    slides.forEach((_, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.setAttribute("aria-label", `Slayt ${index + 1}`);
      button.classList.toggle("is-active", index === currentIndex);
      button.addEventListener("click", () => {
        showSlide(index);
        restartTimer();
      });
      fragment.append(button);
    });

    dotsContainer.innerHTML = "";
    dotsContainer.append(fragment);
  }

  function showSlide(index) {
    currentIndex = index;
    slides.forEach((slide, slideIndex) => {
      slide.classList.toggle("is-active", slideIndex === index);
    });
    [...dotsContainer.children].forEach((dot, dotIndex) => {
      dot.classList.toggle("is-active", dotIndex === index);
    });
  }

  function nextSlide() {
    showSlide((currentIndex + 1) % slides.length);
  }

  function restartTimer() {
    window.clearInterval(timerId);
    timerId = window.setInterval(nextSlide, 5000);
  }

  renderDots();
  showSlide(0);
  restartTimer();
}

initHeroSlider();

function createMonthlyLeaderboardSystem() {
  const playerStorageKey = "deu_trilece_active_player";
  const boardStorageKey = "deu_trilece_monthly_leaderboards";
  const monthFormatter = new Intl.DateTimeFormat("tr-TR", { month: "long", year: "numeric" });

  function getCurrentPeriodKey() {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  }

  function getCurrentPeriodLabel() {
    return monthFormatter.format(new Date());
  }

  function readBoards() {
    try {
      const raw = window.localStorage.getItem(boardStorageKey);
      const parsed = raw ? JSON.parse(raw) : {};
      return parsed && typeof parsed === "object" ? parsed : {};
    } catch {
      return {};
    }
  }

  function saveBoards(boards) {
    try {
      window.localStorage.setItem(boardStorageKey, JSON.stringify(boards));
    } catch {
      // no-op
    }
  }

  function readPlayerName() {
    try {
      return (window.localStorage.getItem(playerStorageKey) || "").trim();
    } catch {
      return "";
    }
  }

  function savePlayerName(name) {
    try {
      window.localStorage.setItem(playerStorageKey, name);
    } catch {
      // no-op
    }
  }

  function normalizeScore(score, decimals = 0) {
    if (!Number.isFinite(score)) {
      return 0;
    }
    return Number(score.toFixed(decimals));
  }

  function getBoard(gameKey) {
    const boards = readBoards();
    const periodBoards = boards[getCurrentPeriodKey()] || {};
    return Array.isArray(periodBoards[gameKey]) ? periodBoards[gameKey] : [];
  }

  function renderBoard(gameKey) {
    const list = document.querySelector(`[data-leaderboard-game="${gameKey}"] .leaderboard-list`);
    if (!list) {
      return;
    }

    const entries = getBoard(gameKey);
    const periodLabel = getCurrentPeriodLabel();
    list.innerHTML = "";

    if (!entries.length) {
      const empty = document.createElement("li");
      empty.className = "leaderboard-empty";
      empty.textContent = `${periodLabel} tablosu henuz bos. Ilk skoru sen birak.`;
      list.append(empty);
      return;
    }

    entries.forEach((entry, index) => {
      const item = document.createElement("li");
      const scoreLabel = gameKey === "caramel-balance" ? `${entry.score.toFixed(1)} sn` : String(entry.score);
      item.innerHTML = `
        <span class="leaderboard-rank">${index + 1}</span>
        <div>
          <span class="leaderboard-name">${entry.name}</span>
          <span class="leaderboard-meta">${periodLabel} liderlik yarisi</span>
        </div>
        <span class="leaderboard-score">${scoreLabel}</span>
      `;
      list.append(item);
    });
  }

  function renderAllBoards() {
    ["seat-rush", "caramel-balance", "cat-snake"].forEach(renderBoard);
  }

  function upsertScore(gameKey, score, options = {}) {
    const playerName = readPlayerName();
    if (!playerName) {
      return { accepted: false, reason: "missing-player" };
    }

    const periodKey = getCurrentPeriodKey();
    const boards = readBoards();
    const periodBoards = boards[periodKey] || {};
    const entries = Array.isArray(periodBoards[gameKey]) ? periodBoards[gameKey] : [];
    const decimals = options.decimals ?? 0;
    const nextScore = normalizeScore(score, decimals);
    const timestamp = new Date().toISOString();
    const previous = entries.find((entry) => entry.name === playerName);

    if (previous && previous.score >= nextScore) {
      renderBoard(gameKey);
      return { accepted: false, reason: "not-better", best: previous.score };
    }

    const nextEntries = entries.filter((entry) => entry.name !== playerName);
    nextEntries.push({
      name: playerName,
      score: nextScore,
      updatedAt: timestamp
    });
    nextEntries.sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return new Date(left.updatedAt).getTime() - new Date(right.updatedAt).getTime();
    });

    periodBoards[gameKey] = nextEntries.slice(0, 10);
    boards[periodKey] = periodBoards;
    saveBoards(boards);
    renderBoard(gameKey);
    return { accepted: true, score: nextScore };
  }

  function initPlayerForm() {
    const form = document.getElementById("leaderboardPlayerForm");
    const input = document.getElementById("leaderboardPlayerName");
    const status = document.getElementById("leaderboardPlayerStatus");

    if (!form || !input || !status) {
      return;
    }

    const existingName = readPlayerName();
    if (existingName) {
      input.value = existingName;
      status.textContent = `Aktif oyuncu: ${existingName}`;
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      const value = input.value.trim();
      if (!value) {
        status.textContent = "Skor kaydi icin once bir oyuncu adi yaz.";
        return;
      }

      savePlayerName(value);
      status.textContent = `Aktif oyuncu: ${value}`;
    });
  }

  initPlayerForm();
  renderAllBoards();

  return {
    submitScore(gameKey, score, options) {
      return upsertScore(gameKey, score, options);
    },
    renderBoard,
    renderAllBoards,
    getPlayerName: readPlayerName
  };
}

const monthlyLeaderboard = createMonthlyLeaderboardSystem();

function initTrileceCounter() {
  const counter = document.getElementById("trileceCounter");

  if (!counter) {
    return;
  }

  const lastTrileceDate = new Date("2026-03-13T00:00:00");
  const now = new Date();
  const msPerDay = 1000 * 60 * 60 * 24;
  const days = Math.max(0, Math.floor((now.getTime() - lastTrileceDate.getTime()) / msPerDay));

  counter.textContent = String(days);
}

initTrileceCounter();

function initCatSnakeGame() {
  const canvas = document.getElementById("catSnakeGame");
  const scoreEl = document.getElementById("catSnakeScore");
  const restartButton = document.getElementById("catSnakeRestart");

  if (!canvas || !scoreEl || !restartButton) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const gridSize = 17;
  const tileSize = canvas.width / gridSize;
  let snake;
  let direction;
  let nextDirection;
  let food;
  let score;
  let loopId;
  let isFocused = false;

  function randomFood() {
    let candidate;
    do {
      candidate = {
        x: Math.floor(Math.random() * gridSize),
        y: Math.floor(Math.random() * gridSize)
      };
    } while (snake.some((part) => part.x === candidate.x && part.y === candidate.y));
    return candidate;
  }

  function resetGame() {
    canvas.focus();
    snake = [
      { x: 8, y: 8 },
      { x: 7, y: 8 },
      { x: 6, y: 8 }
    ];
    direction = { x: 1, y: 0 };
    nextDirection = { x: 1, y: 0 };
    food = randomFood();
    score = 0;
    scoreEl.textContent = "0";
    window.clearInterval(loopId);
    loopId = window.setInterval(step, 160);
    draw();
  }

  function drawGrid() {
    ctx.fillStyle = "#fffaf4";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = "rgba(69, 37, 23, 0.06)";
    for (let i = 0; i <= gridSize; i += 1) {
      ctx.beginPath();
      ctx.moveTo(i * tileSize, 0);
      ctx.lineTo(i * tileSize, canvas.height);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(0, i * tileSize);
      ctx.lineTo(canvas.width, i * tileSize);
      ctx.stroke();
    }
  }

  function drawFood() {
    const x = food.x * tileSize;
    const y = food.y * tileSize;
    ctx.fillStyle = "#b96b31";
    ctx.fillRect(x + 4, y + 8, tileSize - 8, tileSize - 10);
    ctx.fillStyle = "#f5ead8";
    ctx.fillRect(x + 5, y + 8, tileSize - 10, tileSize - 18);
    ctx.fillStyle = "#cf8a49";
    ctx.fillRect(x + 4, y + 4, tileSize - 8, 7);
  }

  function drawSnake() {
    snake.forEach((part, index) => {
      const x = part.x * tileSize;
      const y = part.y * tileSize;
      ctx.fillStyle = index === 0 ? "#452517" : "#6f3f2a";
      ctx.beginPath();
      ctx.roundRect(x + 2, y + 2, tileSize - 4, tileSize - 4, 8);
      ctx.fill();

      if (index === 0) {
        ctx.fillStyle = "#fff";
        ctx.beginPath();
        ctx.arc(x + 9, y + 11, 2.2, 0, Math.PI * 2);
        ctx.arc(x + tileSize - 9, y + 11, 2.2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#f0c3b0";
        ctx.beginPath();
        ctx.moveTo(x + tileSize / 2, y + tileSize / 2);
        ctx.lineTo(x + tileSize / 2 - 4, y + tileSize / 2 + 5);
        ctx.lineTo(x + tileSize / 2 + 4, y + tileSize / 2 + 5);
        ctx.closePath();
        ctx.fill();

        ctx.fillStyle = "#452517";
        ctx.beginPath();
        ctx.moveTo(x + 6, y + 6);
        ctx.lineTo(x + 11, y + 2);
        ctx.lineTo(x + 14, y + 8);
        ctx.closePath();
        ctx.fill();
        ctx.beginPath();
        ctx.moveTo(x + tileSize - 6, y + 6);
        ctx.lineTo(x + tileSize - 11, y + 2);
        ctx.lineTo(x + tileSize - 14, y + 8);
        ctx.closePath();
        ctx.fill();
      }
    });
  }

  function draw() {
    drawGrid();
    drawFood();
    drawSnake();
  }

  function endGame() {
    window.clearInterval(loopId);
    monthlyLeaderboard.submitScore("cat-snake", score);
    ctx.fillStyle = "rgba(69, 37, 23, 0.78)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fffaf4";
    ctx.font = "700 28px Montserrat";
    ctx.textAlign = "center";
    ctx.fillText("Kedi trileceye cok kapildi", canvas.width / 2, canvas.height / 2 - 10);
    ctx.font = "600 16px Source Sans 3";
    ctx.fillText("Yeniden baslatip devam et", canvas.width / 2, canvas.height / 2 + 24);
  }

  function step() {
    direction = nextDirection;
    const head = {
      x: snake[0].x + direction.x,
      y: snake[0].y + direction.y
    };

    const hitWall = head.x < 0 || head.x >= gridSize || head.y < 0 || head.y >= gridSize;
    const hitSelf = snake.some((part) => part.x === head.x && part.y === head.y);

    if (hitWall || hitSelf) {
      endGame();
      return;
    }

    snake.unshift(head);

    if (head.x === food.x && head.y === food.y) {
      score += 1;
      scoreEl.textContent = String(score);
      food = randomFood();
    } else {
      snake.pop();
    }

    draw();
  }

  function handleKeydown(event) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
    }
    if (event.key === "ArrowUp" && direction.y !== 1) nextDirection = { x: 0, y: -1 };
    if (event.key === "ArrowDown" && direction.y !== -1) nextDirection = { x: 0, y: 1 };
    if (event.key === "ArrowLeft" && direction.x !== 1) nextDirection = { x: -1, y: 0 };
    if (event.key === "ArrowRight" && direction.x !== -1) nextDirection = { x: 1, y: 0 };
  }

  canvas.addEventListener("keydown", handleKeydown);
  canvas.addEventListener("focus", () => {
    isFocused = true;
  });
  canvas.addEventListener("blur", () => {
    isFocused = false;
  });
  canvas.addEventListener("pointerdown", () => {
    canvas.focus();
  });
  canvas.addEventListener("mouseenter", () => {
    if (!isFocused) {
      canvas.focus();
    }
  });

  restartButton.addEventListener("click", resetGame);
  resetGame();
}

initCatSnakeGame();

function initSeatRushGame() {
  const canvas = document.getElementById("seatRushGame");
  const scoreEl = document.getElementById("seatRushScore");
  const timeEl = document.getElementById("seatRushTime");
  const restartButton = document.getElementById("seatRushRestart");

  if (!canvas || !scoreEl || !timeEl || !restartButton) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const desks = [];
  const keys = { ArrowUp: false, ArrowDown: false, ArrowLeft: false, ArrowRight: false };
  const roundDuration = 90;
  const seatRadius = 46;
  let player;
  let score = 0;
  let remaining = roundDuration;
  let running = false;
  let started = false;
  let spawnTimer = 0;
  let lastFrame = 0;
  let animationId = 0;
  let overlayMessage = "";
  let overlaySubtext = "";
  let seatedDeskIndex = -1;

  function randomBetween(min, max) {
    return min + Math.random() * (max - min);
  }

  function getDifficultyProgress() {
    return 1 - remaining / roundDuration;
  }

  function scheduleSpawn() {
    const progress = getDifficultyProgress();
    const min = Math.max(0.34, 1.7 - progress * 1.12);
    const max = Math.max(0.82, 2.7 - progress * 1.42);
    spawnTimer = randomBetween(min, max);
  }

  function createLayout() {
    desks.length = 0;
    const positions = [
      { x: 92, y: 92 },
      { x: 210, y: 92 },
      { x: 328, y: 92 },
      { x: 92, y: 214 },
      { x: 210, y: 214 },
      { x: 328, y: 214 }
    ];

    positions.forEach((position) => {
      desks.push({
        ...position,
        state: "open",
        occupant: 0,
        incoming: null,
        occupiedByPlayer: false,
        playerCooldown: 0
      });
    });
  }

  function makeWalker(targetIndex) {
    const edge = Math.floor(Math.random() * 4);
    const points = [
      { x: randomBetween(24, canvas.width - 24), y: -18 },
      { x: canvas.width + 18, y: randomBetween(24, canvas.height - 24) },
      { x: randomBetween(24, canvas.width - 24), y: canvas.height + 18 },
      { x: -18, y: randomBetween(24, canvas.height - 24) }
    ];

    return {
      fromX: points[edge].x,
      fromY: points[edge].y,
      progress: 0,
      duration: randomBetween(1.4, 2.1),
      targetIndex
    };
  }

  function sitAtDesk(index) {
    if (index < 0 || desks[index].state !== "open") {
      return;
    }

    desks.forEach((desk, deskIndex) => {
      if (deskIndex !== index) {
        desk.playerCooldown = 0;
      }
    });

    if (seatedDeskIndex !== -1) {
      desks[seatedDeskIndex].occupiedByPlayer = false;
    }

    seatedDeskIndex = index;
    desks[index].occupiedByPlayer = true;
    player.x = desks[index].x;
    player.y = desks[index].y + 16;
  }

  function standUp() {
    if (seatedDeskIndex === -1) {
      return;
    }

    desks[seatedDeskIndex].playerCooldown = 4;
    desks[seatedDeskIndex].occupiedByPlayer = false;
    seatedDeskIndex = -1;
  }

  function spawnOccupant() {
    const available = desks
      .map((desk, index) => ({ desk, index }))
      .filter(({ desk }) => desk.state === "open" && !desk.occupiedByPlayer);

    if (!available.length) {
      return;
    }

    const cooldownSeats = available.filter(({ desk }) => desk.playerCooldown > 0);
    const pool = cooldownSeats.length ? cooldownSeats : available;
    const choice = pool[Math.floor(Math.random() * pool.length)];
    choice.desk.incoming = makeWalker(choice.index);
  }

  function updateIncoming(dt) {
    desks.forEach((desk) => {
      if (!desk.incoming) {
        return;
      }

      desk.incoming.progress += dt / desk.incoming.duration;
      if (desk.incoming.progress >= 1) {
        const targetDesk = desk;
        desk.incoming = null;

        if (targetDesk.state === "open" && !targetDesk.occupiedByPlayer) {
          targetDesk.state = "occupied";
          targetDesk.occupant = randomBetween(5.2, 7.8);
          return;
        }

        const fallback = desks.find((candidate) => candidate.state === "open" && !candidate.occupiedByPlayer);
        if (fallback) {
          fallback.state = "occupied";
          fallback.occupant = randomBetween(5.2, 7.8);
        }
      }
    });
  }

  function updateOccupied(dt) {
    const progress = getDifficultyProgress();
    const releaseRate = 1 - progress * 0.42;

    desks.forEach((desk) => {
      if (desk.playerCooldown > 0) {
        desk.playerCooldown = Math.max(0, desk.playerCooldown - dt);
      }

      if (desk.state !== "occupied") {
        return;
      }

      desk.occupant -= dt * Math.max(0.36, releaseRate);
      if (desk.occupant <= 0) {
        desk.state = "open";
      }
    });
  }

  function getNearestOpenDesk() {
    let bestIndex = -1;
    let bestDistance = Infinity;

    desks.forEach((desk, index) => {
      if (desk.state !== "open" || desk.occupiedByPlayer) {
        return;
      }

      const distance = Math.hypot(player.x - desk.x, player.y - (desk.y + 16));
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = index;
      }
    });

    return bestDistance <= seatRadius ? bestIndex : -1;
  }

  function allNpcOccupied() {
    return desks.every((desk) => desk.state === "occupied" || desk.occupiedByPlayer);
  }

  function endGame(message, subtext = "Yeniden baslatip bir tur daha deneyebilirsin") {
    running = false;
    started = false;
    overlayMessage = message;
    overlaySubtext = subtext;
    window.cancelAnimationFrame(animationId);
    monthlyLeaderboard.submitScore("seat-rush", score);
    draw();
  }

  function resetGame() {
    createLayout();
    player = {
      x: desks[0].x,
      y: desks[0].y + 52,
      speed: 150
    };
    seatedDeskIndex = -1;
    score = 0;
    remaining = roundDuration;
    running = false;
    started = false;
    overlayMessage = "Alana tikla ve oyunu baslat";
    overlaySubtext = "180 saniye boyunca masa degistir. Ok tuslariyla yuru, boslukla otur veya kalk.";
    scoreEl.textContent = "0";
    timeEl.textContent = `${roundDuration} sn`;
    spawnTimer = 1.6;
    lastFrame = 0;
    Object.keys(keys).forEach((key) => {
      keys[key] = false;
    });
    window.cancelAnimationFrame(animationId);
    draw();
  }

  function movePlayer(dt) {
    if (seatedDeskIndex !== -1) {
      player.x = desks[seatedDeskIndex].x;
      player.y = desks[seatedDeskIndex].y + 16;
      return;
    }

    let moveX = 0;
    let moveY = 0;
    if (keys.ArrowLeft) moveX -= 1;
    if (keys.ArrowRight) moveX += 1;
    if (keys.ArrowUp) moveY -= 1;
    if (keys.ArrowDown) moveY += 1;

    if (moveX !== 0 && moveY !== 0) {
      const length = Math.hypot(moveX, moveY);
      moveX /= length;
      moveY /= length;
    }

    player.x += moveX * player.speed * dt;
    player.y += moveY * player.speed * dt;
    player.x = Math.max(24, Math.min(canvas.width - 24, player.x));
    player.y = Math.max(34, Math.min(canvas.height - 20, player.y));
  }

  function drawDesk(desk, index) {
    const topY = desk.y - 14;
    const leftX = desk.x - 42;
    const isOpen = desk.state === "open" && !desk.occupiedByPlayer;
    const isPlayerSeat = desk.occupiedByPlayer;
    const cooldownRatio = desk.playerCooldown > 0 ? 1 - desk.playerCooldown / 4 : 1;

    ctx.fillStyle = "#6b4225";
    ctx.fillRect(leftX, topY, 84, 12);
    ctx.fillRect(leftX + 10, topY + 12, 8, 30);
    ctx.fillRect(leftX + 66, topY + 12, 8, 30);

    const seatFill = isPlayerSeat
      ? "#f3d36f"
      : desk.playerCooldown > 0
        ? "#e7c89c"
        : (isOpen ? "#cfecc4" : "#a6a19c");
    ctx.fillStyle = seatFill;
    ctx.beginPath();
    ctx.arc(desk.x, desk.y + 16, 22, 0, Math.PI * 2);
    ctx.fill();

    if (desk.playerCooldown > 0 && desk.state === "open" && !desk.occupiedByPlayer) {
      ctx.fillStyle = "rgba(69, 37, 23, 0.16)";
      ctx.fillRect(desk.x - 24, desk.y + 42, 48, 6);
      ctx.fillStyle = "#cf8a49";
      ctx.fillRect(desk.x - 24, desk.y + 42, 48 * Math.max(0, Math.min(1, cooldownRatio)), 6);
    }

    if (desk.state === "occupied") {
      ctx.fillStyle = "#5a3420";
      ctx.beginPath();
      ctx.arc(desk.x, desk.y + 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillRect(desk.x - 7, desk.y + 12, 14, 18);
    } else if (desk.occupiedByPlayer) {
      ctx.fillStyle = "#4b2b1c";
      ctx.beginPath();
      ctx.arc(desk.x, desk.y + 4, 8, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#cf8a49";
      ctx.fillRect(desk.x - 7, desk.y + 12, 14, 18);
    }
  }

  function drawIncoming(desk) {
    if (!desk.incoming) {
      return;
    }

    const progress = Math.min(1, desk.incoming.progress);
    const x = desk.incoming.fromX + (desk.x - desk.incoming.fromX) * progress;
    const y = desk.incoming.fromY + ((desk.y + 16) - desk.incoming.fromY) * progress;
    ctx.fillStyle = "#73462a";
    ctx.beginPath();
    ctx.arc(x, y - 10, 7, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(x - 6, y - 4, 12, 18);
  }

  function drawPlayer() {
    if (seatedDeskIndex !== -1) {
      return;
    }

    ctx.fillStyle = "#3f2418";
    ctx.beginPath();
    ctx.arc(player.x, player.y - 14, 9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillRect(player.x - 8, player.y - 6, 16, 22);
    ctx.fillStyle = "#cf8a49";
    ctx.fillRect(player.x - 5, player.y - 4, 10, 12);
  }

  function drawBackground() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f8ecd6";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ead7b2";
    ctx.fillRect(0, 0, canvas.width, 42);
    ctx.fillStyle = "#d9c29a";
    ctx.fillRect(0, canvas.height - 52, canvas.width, 52);

    ctx.strokeStyle = "rgba(69, 37, 23, 0.08)";
    for (let x = 0; x <= canvas.width; x += 42) {
      ctx.beginPath();
      ctx.moveTo(x, 42);
      ctx.lineTo(x, canvas.height);
      ctx.stroke();
    }
    for (let y = 42; y <= canvas.height; y += 42) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(canvas.width, y);
      ctx.stroke();
    }

    ctx.fillStyle = "#7f532c";
    ctx.font = "700 13px Montserrat";
    ctx.fillText("Kutuphane yer kapmaca", 18, 26);
  }

  function drawOverlay() {
    if (!overlayMessage) {
      return;
    }

    ctx.fillStyle = "rgba(43, 24, 15, 0.76)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fffaf4";
    ctx.textAlign = "center";
    ctx.font = "700 22px Montserrat";
    ctx.fillText(overlayMessage, canvas.width / 2, canvas.height / 2 - 8);
    ctx.font = "600 15px Source Sans 3";
    ctx.fillText(overlaySubtext, canvas.width / 2, canvas.height / 2 + 22);
    ctx.textAlign = "start";
  }

  function startGame() {
    if (started) {
      return;
    }

    started = true;
    running = true;
    overlayMessage = "";
    overlaySubtext = "";
    lastFrame = 0;
    window.cancelAnimationFrame(animationId);
    animationId = window.requestAnimationFrame(tick);
  }

  function draw() {
    drawBackground();
    desks.forEach(drawDesk);
    desks.forEach(drawIncoming);
    drawPlayer();
    drawOverlay();
  }

  function tick(timestamp) {
    if (!running) {
      return;
    }

    if (!lastFrame) {
      lastFrame = timestamp;
    }
    const dt = Math.min(0.032, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;

    remaining = Math.max(0, remaining - dt);
    timeEl.textContent = `${Math.ceil(remaining)} sn`;
    if (remaining <= 0) {
      endGame(`Sure bitti. Skor: ${score}`);
      return;
    }

    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnOccupant();
      scheduleSpawn();
    }

    updateIncoming(dt);
    updateOccupied(dt);
    movePlayer(dt);

    if (seatedDeskIndex === -1 && allNpcOccupied()) {
      endGame("Tum masalar doldu", "Sen ayaktayken alti masa da kapildi.");
      return;
    }

    draw();
    animationId = window.requestAnimationFrame(tick);
  }

  function handleKeyChange(event, isPressed) {
    if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.key)) {
      event.preventDefault();
      keys[event.key] = isPressed;
      return;
    }

    if (event.code === "Space" && isPressed) {
      event.preventDefault();
      const nearestOpenDesk = getNearestOpenDesk();
      if (seatedDeskIndex !== -1) {
        standUp();
      } else if (nearestOpenDesk !== -1) {
        sitAtDesk(nearestOpenDesk);
        score += 1;
        scoreEl.textContent = String(score);
      }
      draw();
      return;
    }
  }

  canvas.addEventListener("keydown", (event) => handleKeyChange(event, true));
  canvas.addEventListener("keyup", (event) => handleKeyChange(event, false));
  canvas.addEventListener("blur", () => {
    keys.ArrowUp = false;
    keys.ArrowDown = false;
    keys.ArrowLeft = false;
    keys.ArrowRight = false;
  });
  canvas.addEventListener("pointerdown", () => {
    canvas.focus();
    startGame();
  });
  canvas.addEventListener("mouseenter", () => {
    if (!started) {
      draw();
    }
  });

  restartButton.addEventListener("click", resetGame);
  resetGame();
}

initSeatRushGame();

function initCaramelBalanceGame() {
  const canvas = document.getElementById("caramelBalanceGame");
  const scoreEl = document.getElementById("caramelBalanceScore");
  const restartButton = document.getElementById("caramelBalanceRestart");
  const storageKey = "deu_trilece_caramel_best_score";

  if (!canvas || !scoreEl || !restartButton) {
    return;
  }

  const ctx = canvas.getContext("2d");
  const plankLength = 250;
  const dropletRadius = 18;
  const sliderWidth = 180;
  const sliderHeight = 14;
  const sliderMinX = 96;
  const sliderMaxX = canvas.width - 96;
  let plankAngle;
  let dropletOffset;
  let dropletVelocity;
  let score;
  let accuracy;
  let animationId;
  let running;
  let started;
  let lastFrame;
  let driftTime;
  let sliderCenter;
  let sliderVelocity;
  let sliderTarget;
  let aimX;
  let pointerInside;
  let misleadTimer;
  let nextMisleadAt;
  let phaseType;
  let phaseTimer;
  let bestScore = readBestScore();
  let isNewRecord = false;

  function readBestScore() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? Number.parseFloat(raw) : 0;
      return Number.isFinite(parsed) ? parsed : 0;
    } catch {
      return 0;
    }
  }

  function saveBestScore(value) {
    try {
      window.localStorage.setItem(storageKey, String(value));
    } catch {
      // no-op
    }
  }

  function resetGame() {
    plankAngle = 0;
    dropletOffset = 0;
    dropletVelocity = 0;
    score = 0;
    accuracy = 100;
    running = false;
    started = false;
    driftTime = 0;
    sliderCenter = canvas.width / 2;
    sliderVelocity = 0;
    sliderTarget = canvas.width / 2;
    aimX = canvas.width / 2;
    pointerInside = false;
    misleadTimer = 0;
    nextMisleadAt = 6 + Math.random() * 4;
    phaseType = "good";
    phaseTimer = 4.6;
    isNewRecord = false;
    lastFrame = 0;
    scoreEl.textContent = "100";
    window.cancelAnimationFrame(animationId);
    draw();
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#f5ead8";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#ead7b2";
    ctx.fillRect(0, 148, canvas.width, 72);
    ctx.fillStyle = "#7a4a24";
    ctx.fillRect(canvas.width / 2 - 8, 98, 16, 74);

    ctx.fillStyle = "rgba(69, 37, 23, 0.16)";
    ctx.fillRect((canvas.width - sliderWidth) / 2, 38, sliderWidth, sliderHeight);
    ctx.fillStyle = "#cf8a49";
    ctx.fillRect(sliderCenter - 22, 34, 44, sliderHeight + 8);
    ctx.fillStyle = "#6f3f2a";
    ctx.beginPath();
    ctx.arc(aimX, 45, 8, 0, Math.PI * 2);
    ctx.fill();

    const balanceWidth = 180;
    ctx.fillStyle = "rgba(69, 37, 23, 0.14)";
    ctx.fillRect(18, 182, balanceWidth, 10);
    ctx.fillStyle = accuracy > 65 ? "#83bf73" : accuracy > 35 ? "#cf8a49" : "#9e442c";
    ctx.fillRect(18, 182, balanceWidth * (accuracy / 100), 10);
    ctx.fillStyle = "#7f532c";
    ctx.font = "700 12px Montserrat";
    ctx.fillText("Denge", 18, 176);

    ctx.save();
    ctx.translate(canvas.width / 2, 110);
    ctx.rotate(plankAngle);
    ctx.fillStyle = "#6f3f2a";
    ctx.beginPath();
    ctx.roundRect(-plankLength / 2, -8, plankLength, 16, 10);
    ctx.fill();

    ctx.fillStyle = "#cf8a49";
    ctx.fillRect(plankLength / 2 - 42, -18, 32, 12);
    ctx.fillStyle = "#f8ecd6";
    ctx.fillRect(plankLength / 2 - 40, -12, 28, 10);

    ctx.translate(dropletOffset, -18);
    ctx.fillStyle = "#8a471f";
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.bezierCurveTo(14, -12, 18, -2, 18, 10);
    ctx.arc(0, 10, dropletRadius, 0, Math.PI, true);
    ctx.bezierCurveTo(-18, -2, -14, -12, 0, -26);
    ctx.fill();
    ctx.restore();

    ctx.fillStyle = "#7f532c";
    ctx.font = "700 13px Montserrat";
    ctx.fillText("Mouse'u slider'in ustunde tut", 18, 26);
    ctx.textAlign = "right";
    ctx.fillText(`Rekor ${Math.floor(bestScore)}`, canvas.width - 18, 26);
    ctx.textAlign = "start";

    if (!started) {
      ctx.fillStyle = "rgba(43, 24, 15, 0.68)";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "#fffaf4";
      ctx.textAlign = "center";
      ctx.font = "700 22px Montserrat";
      ctx.fillText("Alana tikla ve oyunu baslat", canvas.width / 2, canvas.height / 2 - 8);
      ctx.font = "600 15px Source Sans 3";
      ctx.fillText("Slider hizlandikca mouse takibi zorlasacak", canvas.width / 2, canvas.height / 2 + 22);
      ctx.textAlign = "start";
    }
  }

  function endGame() {
    running = false;
    started = false;
    monthlyLeaderboard.submitScore("caramel-balance", score, { decimals: 1 });
    if (score > bestScore) {
      bestScore = score;
      isNewRecord = true;
      saveBestScore(bestScore);
    }
    ctx.fillStyle = "rgba(69, 37, 23, 0.72)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#fffaf4";
    ctx.font = "700 26px Montserrat";
    ctx.textAlign = "center";
    ctx.fillText("Karamel dengesi bozuldu", canvas.width / 2, canvas.height / 2 - 6);
    ctx.font = "600 15px Source Sans 3";
    ctx.fillText("Skor: " + Math.floor(score), canvas.width / 2, canvas.height / 2 + 22);
    if (isNewRecord) {
      ctx.font = "700 18px Montserrat";
      ctx.fillText("Tebrikler yeni rekor", canvas.width / 2, canvas.height / 2 + 50);
    } else {
      ctx.font = "600 15px Source Sans 3";
      ctx.fillText("Rekor: " + Math.floor(bestScore), canvas.width / 2, canvas.height / 2 + 48);
    }
    ctx.textAlign = "start";
  }

  function tick(timestamp) {
    if (!running) {
      return;
    }

    if (!lastFrame) {
      lastFrame = timestamp;
    }
    const dt = Math.min(0.032, (timestamp - lastFrame) / 1000);
    lastFrame = timestamp;
    driftTime += dt;

    const difficulty = Math.min(1, score / 32);
    phaseTimer -= dt;
    if (phaseTimer <= 0) {
      if (phaseType === "good") {
        phaseType = "bad";
        phaseTimer = 1.8 + difficulty * 3.2;
      } else {
        phaseType = "good";
        phaseTimer = 4.6;
      }
    }

    const phaseIntensity = phaseType === "bad" ? (0.35 + difficulty * 0.95) : 0.08;
    const phaseSpeedBoost = phaseType === "bad" ? (0.35 + difficulty * 0.8) : 0;
    const phasePenaltyBoost = phaseType === "bad" ? (1 + difficulty * 0.95) : 0.72;
    const phaseRecoveryBoost = phaseType === "bad" ? 0.72 : 1.08;

    if (score >= nextMisleadAt && misleadTimer <= 0) {
      misleadTimer = (phaseType === "bad" ? 0.4 : 0.22) + difficulty * 0.22;
      sliderTarget = sliderMinX + Math.random() * (sliderMaxX - sliderMinX);
      nextMisleadAt += 4 + Math.random() * 5 - difficulty * 1.4;
    }

    if (misleadTimer > 0) {
      misleadTimer = Math.max(0, misleadTimer - dt);
    } else {
      sliderTarget =
        canvas.width / 2 +
        Math.sin(driftTime * (1.38 + difficulty * (0.9 + phaseSpeedBoost * 0.72))) * (24 + difficulty * (30 + phaseIntensity * 18)) +
        Math.sin(driftTime * (0.66 + difficulty * (0.56 + phaseSpeedBoost * 0.5)) + 1.3) * (10 + difficulty * (18 + phaseIntensity * 14));
    }

    sliderTarget = Math.max(sliderMinX, Math.min(sliderMaxX, sliderTarget));
    sliderVelocity += (sliderTarget - sliderCenter) * (0.48 + difficulty * (0.36 + phaseSpeedBoost * 0.38)) * dt;
    sliderVelocity *= 0.9 - difficulty * (0.02 + phaseSpeedBoost * 0.012);
    sliderCenter += sliderVelocity;

    const delta = Math.abs(aimX - sliderCenter);
    const tolerance = 22;
    const normalizedError = Math.min(1, delta / (tolerance + 34));

    if (pointerInside) {
      accuracy += (1 - normalizedError) * dt * (22 * phaseRecoveryBoost);
      accuracy -= normalizedError * dt * ((15 + difficulty * 8) * phasePenaltyBoost);
    } else {
      accuracy -= dt * ((14 + difficulty * 8) * phasePenaltyBoost);
    }
    accuracy = Math.max(0, Math.min(100, accuracy));
    scoreEl.textContent = String(Math.round(accuracy));

    const instability = 1 - accuracy / 100;
    const aimInfluence = (sliderCenter - aimX) / 140;
    const recenterStrength = (accuracy / 100) * (0.22 - phaseIntensity * 0.05);
    plankAngle =
      Math.sin(driftTime * 1.15) * 0.008 +
      Math.sin(driftTime * (1.8 + phaseSpeedBoost * 0.7) + 0.9) * 0.004 +
      aimInfluence * (0.024 + phaseIntensity * 0.018) +
      instability * (0.06 + phaseIntensity * 0.05);

    dropletVelocity += (
      (sliderCenter - aimX) * (0.28 + phaseIntensity * 0.16) +
      instability * (7 + difficulty * (8 + phaseIntensity * 14)) -
      dropletOffset * recenterStrength
    ) * dt;
    dropletVelocity *= 0.995 - Math.min(0.0048, instability * 0.0028 + difficulty * 0.0009 + phaseIntensity * 0.0008);
    dropletOffset += dropletVelocity * dt;
    score += dt;

    if (accuracy <= 0 || Math.abs(dropletOffset) > plankLength / 2 - 18) {
      draw();
      endGame();
      return;
    }

    draw();
    animationId = window.requestAnimationFrame(tick);
  }

  function startGame() {
    if (started) {
      return;
    }

    started = true;
    running = true;
    lastFrame = 0;
    window.cancelAnimationFrame(animationId);
    animationId = window.requestAnimationFrame(tick);
  }

  function updateAimX(clientX) {
    const rect = canvas.getBoundingClientRect();
    const relative = ((clientX - rect.left) / rect.width) * canvas.width;
    aimX = Math.max(28, Math.min(canvas.width - 28, relative));
  }

  canvas.addEventListener("pointermove", (event) => {
    updateAimX(event.clientX);
    pointerInside = true;
  });
  canvas.addEventListener("pointerleave", () => {
    pointerInside = false;
  });
  canvas.addEventListener("pointerdown", () => {
    canvas.focus();
    pointerInside = true;
    startGame();
  });
  canvas.addEventListener("mouseenter", () => {
    if (!started) {
      draw();
    }
  });

  restartButton.addEventListener("click", resetGame);
  resetGame();
}

initCaramelBalanceGame();

function initWaitReplyForm() {
  const form = document.getElementById("waitReplyForm");
  const input = document.getElementById("waitReplyInput");
  const list = document.getElementById("waitReplyList");
  const storageKey = "deu_trilece_wait_replies";

  if (!form || !input || !list) {
    return;
  }

  function readReplies() {
    try {
      const raw = window.localStorage.getItem(storageKey);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  function saveReplies(replies) {
    window.localStorage.setItem(storageKey, JSON.stringify(replies));
  }

  function renderReplies(replies) {
    list.innerHTML = "";
    replies.forEach((reply) => {
      const item = document.createElement("article");
      item.innerHTML = `<p>${reply}</p>`;
      list.append(item);
    });
  }

  const existingReplies = readReplies();
  renderReplies(existingReplies);

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const value = input.value.trim();
    if (!value) {
      return;
    }

    const replies = readReplies();
    replies.unshift(value);
    saveReplies(replies);
    renderReplies(replies);
    input.value = "";
  });
}

initWaitReplyForm();

function initImageLightbox() {
  const dialog = document.getElementById("imageLightbox");
  const image = document.getElementById("imageLightboxImg");
  const closeButton = document.getElementById("imageLightboxClose");

  if (!dialog || !image || !closeButton) {
    return;
  }

  const targets = [...document.querySelectorAll("[data-lightboxable]")];

  function getFullSrc(src) {
    if (src.includes("drive.google.com/thumbnail?id=")) {
      return src.replace("sz=w1200", "sz=w2000");
    }
    return src;
  }

  function openLightbox(target) {
    const mode = target.dataset.lightboxMode || "";
    image.classList.toggle("is-cropped", mode === "crop");
    image.src = mode === "crop"
      ? (target.getAttribute("src") || "")
      : getFullSrc(target.getAttribute("src") || "");
    image.alt = target.getAttribute("alt") || "";
    dialog.showModal();
  }

  function closeLightbox() {
    dialog.close();
    image.removeAttribute("src");
    image.classList.remove("is-cropped");
  }

  targets.forEach((target) => {
    target.addEventListener("click", () => openLightbox(target));
  });

  closeButton.addEventListener("click", closeLightbox);
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      closeLightbox();
    }
  });
}

initImageLightbox();

function initMerchGallery() {
  const mainImage = document.getElementById("merchMainImage");
  const zoomStage = document.getElementById("merchZoomStage");
  const thumbs = [...document.querySelectorAll("[data-merch-thumb]")];

  if (!mainImage || !zoomStage || !thumbs.length) {
    return;
  }

  function updateImage(button) {
    const src = button.dataset.imageSrc || "";
    const alt = button.dataset.imageAlt || "";

    mainImage.src = src;
    mainImage.alt = alt;

    thumbs.forEach((thumb) => {
      thumb.classList.toggle("is-active", thumb === button);
    });
  }

  function resetZoom() {
    zoomStage.classList.remove("is-zoomed");
    zoomStage.style.setProperty("--zoom-x", "50%");
    zoomStage.style.setProperty("--zoom-y", "50%");
  }

  thumbs.forEach((thumb) => {
    thumb.addEventListener("click", () => updateImage(thumb));
  });

  zoomStage.addEventListener("pointermove", (event) => {
    if (event.pointerType && event.pointerType !== "mouse") {
      return;
    }

    const bounds = zoomStage.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width) * 100;
    const y = ((event.clientY - bounds.top) / bounds.height) * 100;

    zoomStage.classList.add("is-zoomed");
    zoomStage.style.setProperty("--zoom-x", `${x}%`);
    zoomStage.style.setProperty("--zoom-y", `${y}%`);
  });

  zoomStage.addEventListener("pointerleave", resetZoom);
  zoomStage.addEventListener("pointercancel", resetZoom);
}

initMerchGallery();

function initMerchSoonButtons() {
  const triggers = [...document.querySelectorAll("#merchSoonTrigger, .merch-soon-button")];

  if (!triggers.length) {
    return;
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener("click", (event) => {
      event.preventDefault();
      window.alert("Merch alani cok yakinda aciliyor.");
    });
  });
}

initMerchSoonButtons();
