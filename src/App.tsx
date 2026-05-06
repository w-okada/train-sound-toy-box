import { useCallback, useEffect, useRef, useState } from "react";
import {
  good as goodSounds,
  bad as badSounds,
  goodMovies,
} from "virtual:audio-manifest";
import "./App.css";

type ShapeType = "circle" | "triangle" | "square" | "star";

const SHAPE_TYPES: ShapeType[] = ["circle", "triangle", "square", "star"];

const SHAPE_NAME: Record<ShapeType, string> = {
  circle: "まる",
  triangle: "さんかく",
  square: "しかく",
  star: "ほし",
};

const PASTEL_COLORS = [
  "#FFB3BA",
  "#FFD7BA",
  "#FFFFBA",
  "#BAFFC9",
  "#BAE1FF",
  "#D7BAFF",
  "#FFBAE1",
  "#BAFFE1",
];

interface ShapeInstance {
  id: number;
  type: ShapeType;
  color: string;
  xPercent: number;
  yPercent: number;
  sizePx: number;
  sound: string;
  movie: string;
  isTarget: boolean;
}

interface Session {
  target: ShapeType;
  shapes: ShapeInstance[];
}

const randInt = (min: number, max: number) =>
  Math.floor(Math.random() * (max - min + 1)) + min;

const pick = <T,>(arr: readonly T[]): T =>
  arr[Math.floor(Math.random() * arr.length)];

const shuffle = <T,>(arr: readonly T[]): T[] => {
  const out = [...arr];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
};

const buildSession = (): Session => {
  const target = pick(SHAPE_TYPES);

  const rawShapes: Omit<ShapeInstance, "xPercent" | "yPercent" | "sizePx">[] =
    [];
  let id = 0;
  const colorBag = shuffle(PASTEL_COLORS);
  let colorIdx = 0;
  const nextColor = () => {
    const c = colorBag[colorIdx % colorBag.length];
    colorIdx++;
    return c;
  };
  for (const type of SHAPE_TYPES) {
    const count = randInt(2, 3);
    for (let i = 0; i < count; i++) {
      const isTarget = type === target;
      const pool = isTarget ? goodSounds : badSounds;
      rawShapes.push({
        id: id++,
        type,
        color: nextColor(),
        sound: pool.length > 0 ? pick(pool) : "",
        movie: isTarget && goodMovies.length > 0 ? pick(goodMovies) : "",
        isTarget,
      });
    }
  }

  // grid layout with jitter so positions don't overlap
  const total = rawShapes.length;
  const cols = Math.ceil(Math.sqrt(total * 1.5));
  const rows = Math.ceil(total / cols);
  const cells: { r: number; c: number }[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) cells.push({ r, c });
  }
  const shuffledCells = shuffle(cells);
  const cellWidthPct = 100 / cols;
  const cellHeightPct = 100 / rows;

  const shapes: ShapeInstance[] = rawShapes.map((s, i) => {
    const { r, c } = shuffledCells[i];
    const cx = (c + 0.5) * cellWidthPct;
    const cy = (r + 0.5) * cellHeightPct;
    const jitterX = (Math.random() - 0.5) * cellWidthPct * 0.4;
    const jitterY = (Math.random() - 0.5) * cellHeightPct * 0.4;
    return {
      ...s,
      xPercent: cx + jitterX,
      yPercent: cy + jitterY,
      sizePx: randInt(200, 270),
    };
  });

  return { target, shapes: shuffle(shapes) };
};

const ShapeSvg = ({ type, color }: { type: ShapeType; color: string }) => {
  switch (type) {
    case "circle":
      return (
        <svg viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="44"
            fill={color}
            stroke="#fff"
            strokeWidth="4"
          />
        </svg>
      );
    case "square":
      return (
        <svg viewBox="0 0 100 100">
          <rect
            x="8"
            y="8"
            width="84"
            height="84"
            rx="10"
            fill={color}
            stroke="#fff"
            strokeWidth="4"
          />
        </svg>
      );
    case "triangle":
      return (
        <svg viewBox="0 0 100 100">
          <polygon
            points="50,10 92,86 8,86"
            fill={color}
            stroke="#fff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
      );
    case "star":
      return (
        <svg viewBox="0 0 100 100">
          <polygon
            points="50,8 61,38 94,38 67,57 77,90 50,70 23,90 33,57 6,38 39,38"
            fill={color}
            stroke="#fff"
            strokeWidth="4"
            strokeLinejoin="round"
          />
        </svg>
      );
  }
};

const App = () => {
  const [session, setSession] = useState<Session>(buildSession);
  const [feedback, setFeedback] = useState<Record<number, "correct" | "wrong">>(
    {},
  );
  const [movie, setMovie] = useState<{ src: string; playId: number } | null>(
    null,
  );
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const playIdRef = useRef(0);
  const lastTouchAtRef = useRef(0);

  const isStaleMouseAfterTouch = () =>
    Date.now() - lastTouchAtRef.current < 2000;

  const stopCurrentAudio = () => {
    const current = currentAudioRef.current;
    if (current) {
      current.pause();
      current.currentTime = 0;
      currentAudioRef.current = null;
    }
  };

  const closeMovie = () => {
    const v = videoRef.current;
    if (v) {
      v.pause();
      v.currentTime = 0;
    }
    setMovie(null);
  };

  const playMovie = (src: string) => {
    playIdRef.current += 1;
    setMovie({ src, playId: playIdRef.current });
  };

  const handleTap = useCallback((shape: ShapeInstance) => {
    stopCurrentAudio();
    if (shape.isTarget && shape.movie) {
      playMovie(shape.movie);
    } else if (shape.sound) {
      const audio = new Audio(shape.sound);
      currentAudioRef.current = audio;
      audio.addEventListener("ended", () => {
        if (currentAudioRef.current === audio) {
          currentAudioRef.current = null;
        }
      });
      audio.play().catch(() => {
        /* ignore autoplay errors */
      });
    }
    setFeedback((prev) => ({
      ...prev,
      [shape.id]: shape.isTarget ? "correct" : "wrong",
    }));
    window.setTimeout(() => {
      setFeedback((prev) => {
        const next = { ...prev };
        delete next[shape.id];
        return next;
      });
    }, 600);
  }, []);

  const restart = () => {
    stopCurrentAudio();
    closeMovie();
    setSession(buildSession());
    setFeedback({});
  };

  useEffect(() => {
    const block = (e: Event) => e.preventDefault();
    document.addEventListener("gesturestart", block);
    document.addEventListener("gesturechange", block);
    document.addEventListener("gestureend", block);
    return () => {
      document.removeEventListener("gesturestart", block);
      document.removeEventListener("gesturechange", block);
      document.removeEventListener("gestureend", block);
    };
  }, []);

  const noAudio = goodSounds.length === 0 || badSounds.length === 0;

  return (
    <div className="app">
      <header className="header">
        <div className="header__prompt">
          <span className="header__icon">
            <ShapeSvg type={session.target} color="#ffd166" />
          </span>
          <span>{SHAPE_NAME[session.target]}を タッチしてね</span>
        </div>
        <button type="button" className="retry-button" onClick={restart}>
          もういちど
        </button>
      </header>
      <main className="board">
        {session.shapes.map((shape) => {
          const fb = feedback[shape.id];
          const className = [
            "shape",
            fb === "correct" ? "shape--correct" : "",
            fb === "wrong" ? "shape--wrong" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <div
              key={shape.id}
              className={className}
              style={{
                left: `${shape.xPercent}%`,
                top: `${shape.yPercent}%`,
                width: `${shape.sizePx}px`,
                height: `${shape.sizePx}px`,
              }}
              onTouchStart={() => {
                lastTouchAtRef.current = Date.now();
                handleTap(shape);
              }}
              onMouseDown={() => {
                if (isStaleMouseAfterTouch()) return;
                handleTap(shape);
              }}
            >
              <ShapeSvg type={shape.type} color={shape.color} />
            </div>
          );
        })}
        {noAudio && (
          <div className="empty-message">
            <div>
              <p>
                <strong>public/assets/good/*.mp3</strong> と
                <br />
                <strong>public/assets/bad/*.mp3</strong> に
                <br />
                おとファイルを いれてください
              </p>
            </div>
          </div>
        )}
      </main>
      {movie && (
        <div
          className="movie-overlay"
          onTouchStart={() => {
            lastTouchAtRef.current = Date.now();
            closeMovie();
          }}
          onMouseDown={() => {
            if (isStaleMouseAfterTouch()) return;
            closeMovie();
          }}
          role="presentation"
        >
          <video
            key={movie.playId}
            ref={videoRef}
            className="movie-overlay__video"
            src={movie.src}
            autoPlay
            playsInline
            onEnded={closeMovie}
          />
        </div>
      )}
    </div>
  );
};

export default App;
