import { useEffect, useRef, useState } from 'react';
import backgroundImage from '../assets/background.png';
import basophilImage from '../Basophil.png';
import eosinophilImage from '../Eosinophil.png';
import lymphocyteImage from '../Lymphocyte.png';
import monocyteImage from '../Monocyte.png';
import neutrophilImage from '../Neutrophil.png';

const BOARD_COLUMNS = 24;
const BOARD_ROWS = 18;
const START_DIRECTION = { x: 1, y: 0 };
const BEST_TIME_KEY = 'cell-snake-best-time';
const MAX_CAPTURES = 10;
const INITIAL_SNAKE = Array.from(
  { length: MAX_CAPTURES },
  (_, index) => ({ x: 12 - index, y: 9 }),
);
const CELL_TYPES = [
  {
    id: 'lymphocyte',
    name: 'Lymphocyte',
    image: lymphocyteImage,
    description: 'Recognizes specific threats and helps coordinate immune defenses.',
  },
  {
    id: 'monocyte',
    name: 'Monocyte',
    image: monocyteImage,
    description: 'Engulfs microbes and can mature into macrophages in tissues.',
  },
  {
    id: 'neutrophil',
    name: 'Neutrophil',
    image: neutrophilImage,
    description: 'Rapidly responds to infection, especially bacteria and fungi.',
  },
  {
    id: 'basophil',
    name: 'Basophil',
    image: basophilImage,
    description: 'Releases histamine during allergic and inflammatory responses.',
  },
  {
    id: 'eosinophil',
    name: 'Eosinophil',
    image: eosinophilImage,
    description: 'Helps defend against parasites and participates in allergies.',
  },
];
const DIRECTIONS = {
  arrowup: { x: 0, y: -1 },
  w: { x: 0, y: -1 },
  arrowdown: { x: 0, y: 1 },
  s: { x: 0, y: 1 },
  arrowleft: { x: -1, y: 0 },
  a: { x: -1, y: 0 },
  arrowright: { x: 1, y: 0 },
  d: { x: 1, y: 0 },
};

function positionKey({ x, y }) {
  return `${x},${y}`;
}

function chooseRandomCell() {
  return CELL_TYPES[Math.floor(Math.random() * CELL_TYPES.length)];
}

function isOpposite(first, second) {
  return first.x + second.x === 0 && first.y + second.y === 0;
}

function chooseOpenPosition(occupied, head) {
  const preferred = [];
  const available = [];

  for (let y = 0; y < BOARD_ROWS; y += 1) {
    for (let x = 0; x < BOARD_COLUMNS; x += 1) {
      const position = { x, y };
      if (occupied.has(positionKey(position))) continue;

      available.push(position);
      if (Math.abs(x - head.x) + Math.abs(y - head.y) >= 4) preferred.push(position);
    }
  }

  const options = preferred.length > 0 ? preferred : available;
  if (options.length === 0) return null;
  return options[Math.floor(Math.random() * options.length)];
}

function createWbcField(targetId, snake) {
  const occupied = new Set(snake.map(positionKey));
  const head = snake[0];

  return CELL_TYPES.flatMap((cellType) => {
    const position = chooseOpenPosition(occupied, head);
    if (!position) return [];

    occupied.add(positionKey(position));
    return [{
      ...cellType,
      ...position,
      isTarget: cellType.id === targetId,
    }];
  });
}

function relocateWbcCell(cells, cellId, snake) {
  const occupied = new Set(snake.map(positionKey));
  cells.forEach((cell) => {
    if (cell.id !== cellId) occupied.add(positionKey(cell));
  });

  const position = chooseOpenPosition(occupied, snake[0]);
  if (!position) return cells;

  return cells.map((cell) => (
    cell.id === cellId ? { ...cell, ...position } : cell
  ));
}

function copyInitialSnake() {
  return INITIAL_SNAKE.map((segment) => ({ ...segment }));
}

function formatTime(milliseconds) {
  const tenths = Math.floor(milliseconds / 100);
  const minutes = Math.floor(tenths / 600);
  const seconds = Math.floor(tenths / 10) % 60;
  return `${minutes}:${String(seconds).padStart(2, '0')}.${tenths % 10}`;
}

function App() {
  const [snake, setSnake] = useState(copyInitialSnake);
  const snakeRef = useRef(snake);
  const [target, setTarget] = useState(chooseRandomCell);
  const [wbcCells, setWbcCells] = useState(() => createWbcField(target.id, snake));
  const wbcCellsRef = useRef(wbcCells);
  const directionRef = useRef(START_DIRECTION);
  const [status, setStatus] = useState('ready');
  const [lives, setLives] = useState(3);
  const [elapsedMs, setElapsedMs] = useState(0);
  const [bestTimeMs, setBestTimeMs] = useState(() => {
    const storedTime = window.localStorage.getItem(BEST_TIME_KEY);
    if (storedTime === null) return null;
    const parsedTime = Number(storedTime);
    return Number.isFinite(parsedTime) && parsedTime >= 0 ? parsedTime : null;
  });
  const elapsedBeforePeriodRef = useRef(0);
  const clockStartedAtRef = useRef(null);
  const [captures, setCaptures] = useState(0);
  const [notice, setNotice] = useState('Capture the matching WBC. Avoid the others.');
  const speed = Math.max(80, 155 - Math.floor(captures / 5) * 10);

  useEffect(() => {
    if (status !== 'playing') return undefined;

    const timer = window.setInterval(() => {
      const startedAt = clockStartedAtRef.current;
      const elapsed =
        elapsedBeforePeriodRef.current +
        (startedAt === null ? 0 : performance.now() - startedAt);
      setElapsedMs(elapsed);
    }, 100);

    return () => window.clearInterval(timer);
  }, [status]);

  useEffect(() => {
    if (status !== 'playing') return undefined;

    const timer = window.setInterval(() => {
      const currentSnake = snakeRef.current;
      const head = currentSnake[0];
      const direction = directionRef.current;
      const nextHead = { x: head.x + direction.x, y: head.y + direction.y };
      const hitWall =
        nextHead.x < 0 ||
        nextHead.x >= BOARD_COLUMNS ||
        nextHead.y < 0 ||
        nextHead.y >= BOARD_ROWS;
      const hitCell = wbcCellsRef.current.find(
        (cell) => cell.x === nextHead.x && cell.y === nextHead.y,
      );
      const isCorrectCell = hitCell?.isTarget === true;
      const collisionBody = isCorrectCell
        ? currentSnake.slice(0, -2)
        : currentSnake.slice(0, -1);
      const hitSnake = collisionBody.some(
        (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
      );

      if (hitWall || hitSnake) {
        const remainingLives = lives - 1;
        setLives(remainingLives);
        setNotice(hitWall ? 'Wall collision — one life lost.' : 'Self-collision — one life lost.');

        if (remainingLives <= 0) {
          freezeClock();
          setStatus('over');
          return;
        }

        const nextSnake = copyInitialSnake();
        const nextCells = createWbcField(target.id, nextSnake);
        snakeRef.current = nextSnake;
        wbcCellsRef.current = nextCells;
        directionRef.current = START_DIRECTION;
        setSnake(nextSnake);
        setWbcCells(nextCells);
        return;
      }

      const nextSnake = isCorrectCell
        ? [nextHead, ...currentSnake.slice(0, -2)]
        : [nextHead, ...currentSnake.slice(0, -1)];
      snakeRef.current = nextSnake;
      setSnake(nextSnake);

      if (!hitCell) return;

      if (hitCell.isTarget) {
        const nextCaptureCount = captures + 1;
        setCaptures(nextCaptureCount);
        setNotice(`Correct: ${hitCell.name} captured. One segment shorter.`);

        if (nextCaptureCount >= MAX_CAPTURES) {
          const finishTime = freezeClock();
          if (bestTimeMs === null || finishTime < bestTimeMs) {
            window.localStorage.setItem(BEST_TIME_KEY, String(finishTime));
            setBestTimeMs(finishTime);
          }
          setNotice('Immunity achieved!');
          setStatus('over');
          return;
        }

        const nextTarget = chooseRandomCell();
        const nextCells = createWbcField(nextTarget.id, nextSnake);
        setTarget(nextTarget);
        wbcCellsRef.current = nextCells;
        setWbcCells(nextCells);
        return;
      }

      const remainingLives = lives - 1;
      const nextCells = relocateWbcCell(wbcCellsRef.current, hitCell.id, nextSnake);
      setLives(remainingLives);
      setNotice(`Wrong WBC: ${hitCell.name}. One life lost.`);
      wbcCellsRef.current = nextCells;
      setWbcCells(nextCells);
      if (remainingLives <= 0) {
        freezeClock();
        setStatus('over');
      }
    }, speed);

    return () => window.clearInterval(timer);
  }, [bestTimeMs, captures, lives, speed, status, target]);

  useEffect(() => {
    function handleKeyDown(event) {
      if (event.code === 'Space') {
        event.preventDefault();
        if (status === 'playing') pauseGame();
        else if (status === 'over') startNewGame();
        else continueGame();
        return;
      }

      const direction = DIRECTIONS[event.key.toLowerCase()];
      if (!direction || status === 'over') return;

      event.preventDefault();
      if (isOpposite(direction, directionRef.current)) return;
      directionRef.current = direction;
      if (status === 'ready' || status === 'paused') continueGame();
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [status]);

  function freezeClock() {
    const startedAt = clockStartedAtRef.current;
    const elapsed =
      elapsedBeforePeriodRef.current +
      (startedAt === null ? 0 : performance.now() - startedAt);
    elapsedBeforePeriodRef.current = elapsed;
    clockStartedAtRef.current = null;
    setElapsedMs(elapsed);
    return elapsed;
  }

  function pauseGame() {
    if (status !== 'playing') return;
    freezeClock();
    setStatus('paused');
  }

  function startNewGame() {
    const nextSnake = copyInitialSnake();
    const nextTarget = chooseRandomCell();
    const nextCells = createWbcField(nextTarget.id, nextSnake);
    snakeRef.current = nextSnake;
    wbcCellsRef.current = nextCells;
    directionRef.current = START_DIRECTION;
    setSnake(nextSnake);
    setTarget(nextTarget);
    setWbcCells(nextCells);
    setLives(3);
    elapsedBeforePeriodRef.current = 0;
    clockStartedAtRef.current = performance.now();
    setElapsedMs(0);
    setCaptures(0);
    setNotice('Capture the matching WBC. Avoid the others.');
    setStatus('playing');
  }

  function requestDirection(direction) {
    if (status === 'over' || isOpposite(direction, directionRef.current)) return;
    directionRef.current = direction;
    if (status === 'ready' || status === 'paused') continueGame();
  }

  function continueGame() {
    if (status === 'over') {
      startNewGame();
      return;
    }

    if (status === 'ready') {
      elapsedBeforePeriodRef.current = 0;
      setElapsedMs(0);
    }
    if (clockStartedAtRef.current === null) {
      clockStartedAtRef.current = performance.now();
    }
    setStatus('playing');
  }

  const snakePositions = new Map(
    snake.map((segment, index) => [positionKey(segment), index]),
  );
  const wbcPositions = new Map(wbcCells.map((cell) => [positionKey(cell), cell]));
  const boardCells = Array.from({ length: BOARD_COLUMNS * BOARD_ROWS }, (_, index) => {
    const x = index % BOARD_COLUMNS;
    const y = Math.floor(index / BOARD_COLUMNS);
    const key = `${x},${y}`;
    const snakeIndex = snakePositions.get(key);
    const wbc = wbcPositions.get(key);
    const cellLabel = wbc
      ? `${wbc.name}${wbc.isTarget ? ', target' : ', avoid'}`
      : snakeIndex === 0
        ? 'Player head'
        : snakeIndex !== undefined
          ? 'Player body'
          : 'Blood smear';

    return (
      <div className="board-cell" key={key} role="gridcell" aria-label={cellLabel}>
        {snakeIndex !== undefined && (
          <span className={`snake-segment${snakeIndex === 0 ? ' snake-head' : ''}`} />
        )}
        {wbc && (
          <img
            className="wbc-image"
            src={wbc.image}
            alt=""
            draggable="false"
          />
        )}
      </div>
    );
  });

  const overlay = status === 'ready'
    ? {
      eyebrow: 'MICROSCOPE FIELD READY',
      title: 'Find the matching WBC',
      description: 'Capture the cell shown above. Other WBC types cost a life.',
      button: 'Start game',
    }
    : status === 'paused'
      ? {
        eyebrow: 'PAUSED',
        title: 'Take a breather',
        description: 'Resume when you are ready to scan the field.',
        button: 'Resume',
      }
      : status === 'over'
        ? captures >= MAX_CAPTURES
          ? {
            eyebrow: 'Immunity achieved!',
            title: 'The infection has been cleared from the body.',
            description: `Completion time: ${formatTime(elapsedMs)}.`,
            button: 'Play again',
          }
          : {
            eyebrow: 'GAME OVER',
            title: 'Game over',
            description: `Time: ${formatTime(elapsedMs)}. WBC captured: ${captures}.`,
            button: 'Play again',
          }
        : null;

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <h1>WBC <span>Game</span></h1>
        </div>
        <p className="header-caption">Follow the target. Leave the other white cells alone.</p>
      </header>

      <div className="game-layout">
        <section className="play-column" aria-label="WBC game">
          <div className="game-hud">
            <section className="target-card" aria-live="polite">
              <p className="eyebrow">CURRENT TARGET</p>
              <div className="target-cell">
                <img src={target.image} alt={target.name} />
                <div>
                  <strong>{target.name}</strong>
                  <span>Capture the matching cell</span>
                </div>
              </div>
            </section>

            <article className="hud-card score-card">
              <span className="hud-label">TIME SCORE</span>
              <strong>{formatTime(elapsedMs)}</strong>
              <span className="hud-note">Lower time wins</span>
            </article>
            <article className="hud-card best-card">
              <span className="hud-label">FASTEST TIME</span>
              <strong>{bestTimeMs === null ? '--:--.-' : formatTime(bestTimeMs)}</strong>
              <span className="hud-note">Saved in this browser</span>
            </article>
            <article className="hud-card lives-card">
              <span className="hud-label">LIVES</span>
              <div className="life-list" aria-label={`${lives} of 3 lives remaining`}>
                {[0, 1, 2].map((life) => (
                  <span className={life < lives ? 'life-heart' : 'life-heart life-lost'} key={life}>♥</span>
                ))}
              </div>
              <span className="hud-note">{lives} remaining</span>
            </article>
          </div>

          <section className="microscope-card">
            <div className="scene-heading">
              <div>
                <p className="eyebrow">MICROSCOPE VIEW</p>
                <h2>Peripheral blood field</h2>
              </div>
            </div>

            <div className="scene-frame">
              <div
                className="game-board"
                role="grid"
                aria-label="Peripheral blood smear game field"
              >
                <img
                  className="smear-scene"
                  src={backgroundImage}
                  alt=""
                  draggable="false"
                />
                {boardCells}
              </div>
              {overlay && (
                <div className="board-overlay">
                  <div className="overlay-card">
                    <span className="overlay-eyebrow">{overlay.eyebrow}</span>
                    <h2>{overlay.title}</h2>
                    <p>{overlay.description}</p>
                    <button className="primary-button" onClick={continueGame} type="button">
                      {overlay.button}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className={`game-notice${notice.startsWith('Wrong') || notice.includes('collision') ? ' notice-warning' : ''}`}>
              {notice}
            </p>

            <div className="game-controls">
              <p className="keyboard-hint">
                Move: <kbd>↑</kbd><kbd>←</kbd><kbd>↓</kbd><kbd>→</kbd> or <kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd>
                <span>·</span><kbd>Space</kbd> pause
              </p>
              <div className="control-actions">
                <button
                  className="secondary-button"
                  onClick={() => (status === 'playing' ? pauseGame() : continueGame())}
                  type="button"
                >
                  {status === 'playing' ? 'Pause' : status === 'paused' ? 'Resume' : 'Start'}
                </button>
                <button className="restart-button" onClick={startNewGame} type="button">
                  New game
                </button>
              </div>
            </div>

            <div className="touch-controls" aria-label="Touch controls">
              <button onClick={() => requestDirection(DIRECTIONS.arrowup)} aria-label="Move up" type="button">↑</button>
              <button onClick={() => requestDirection(DIRECTIONS.arrowleft)} aria-label="Move left" type="button">←</button>
              <button onClick={() => requestDirection(DIRECTIONS.arrowdown)} aria-label="Move down" type="button">↓</button>
              <button onClick={() => requestDirection(DIRECTIONS.arrowright)} aria-label="Move right" type="button">→</button>
            </div>
          </section>
        </section>

        <aside className="side-column">
          <section className="info-card">
            <p className="eyebrow">CELL GUIDE</p>
            <h2>Meet the Warriors</h2>
            <ul className="cell-guide-list">
              {CELL_TYPES.map((cell) => (
                <li className="cell-guide-item" key={cell.id}>
                  <img className="cell-guide-image" src={cell.image} alt="" />
                  <div>
                    <h3>{cell.name}</h3>
                    <p>{cell.description}</p>
                  </div>
                </li>
              ))}
            </ul>
          </section>

          <section className="info-card">
            <p className="eyebrow">FIELD RULES</p>
            <h2>Know your target</h2>
            <ul className="rules-list">
              <li><span className="rule-dot rule-target" />Capture only the WBC shown above.</li>
              <li><span className="rule-dot rule-avoid" />A different WBC costs one life.</li>
              <li><span className="rule-dot rule-safe" />RBCs and platelets are harmless scenery.</li>
              <li><span className="rule-dot rule-life" />Wall or self-collision costs one life.</li>
            </ul>
          </section>
        </aside>
      </div>

    </main>
  );
}

export default App;
