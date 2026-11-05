import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TouchableWithoutFeedback, useWindowDimensions, View } from 'react-native';

// ---------------------------------------------------------------
// DINO RUNNER - a simple Chrome-dino style game
//   Tap anywhere to start, tap to jump over the cacti.
//   Hit a cactus = game over. Tap again to restart.
//
// How it works (game loop idea):
//   1. requestAnimationFrame calls tick() about 60 times per second.
//   2. tick() moves everything a little (physics), checks collisions,
//      then asks React to redraw the screen.
//   3. All "fast changing" numbers live in useRef (they do NOT cause a
//      redraw by themselves). We redraw manually with forceRender().
// ---------------------------------------------------------------

// ----- Game settings (change these to experiment!) -----
const GROUND_HEIGHT = 90;       // height of the ground area at the bottom
const DINO_SIZE = 44;           // width and height of the dinosaur
const DINO_X = 50;              // distance of the dinosaur from the left edge
const GRAVITY = 2400;           // how fast the dino falls (pixels per second squared)
const JUMP_VELOCITY = 850;      // how strongly the dino jumps (pixels per second)
const CACTUS_WIDTH = 26;
const START_SPEED = 320;        // starting speed of the cacti (pixels per second)
const SPEED_UP = 10;            // how much faster the game gets every second

type Cactus = { id: number; x: number; height: number };
type Status = 'ready' | 'running' | 'over';

export default function App() {
  const { width } = useWindowDimensions();
  const [, setFrameCount] = useState(0);
  const forceRender = () => setFrameCount((n) => n + 1);

  // ----- Game state (kept in refs so the game loop always sees the newest values) -----
  const status = useRef<Status>('ready');
  const dinoY = useRef(0);            // height above the ground (0 = standing)
  const velocity = useRef(0);         // up/down speed of the dino
  const cacti = useRef<Cactus[]>([]);
  const speed = useRef(START_SPEED);
  const score = useRef(0);
  const bestScore = useRef(0);
  const timeToNextCactus = useRef(1);
  const nextId = useRef(1);
  const lastTime = useRef(0);
  const frameId = useRef<number | null>(null);
  const widthRef = useRef(width);
  widthRef.current = width;

  // The game loop. It is re-assigned on every render, but only uses refs.
  const tick = useRef<(time: number) => void>(() => {});
  tick.current = (time: number) => {
    if (status.current !== 'running') {
      return;
    }

    // Time since the last frame (in seconds). Capped so the game never "jumps" after a pause.
    if (lastTime.current === 0) {
      lastTime.current = time;
    }
    const dt = Math.min((time - lastTime.current) / 1000, 0.05);
    lastTime.current = time;

    // 1) Dino physics: gravity pulls down, velocity moves the dino
    velocity.current -= GRAVITY * dt;
    dinoY.current += velocity.current * dt;
    if (dinoY.current <= 0) {
      dinoY.current = 0;
      velocity.current = 0;
    }

    // 2) The game gets faster over time and the score goes up
    speed.current += SPEED_UP * dt;
    score.current += dt * 10;

    // 3) Move every cactus to the left and remove the ones that left the screen
    cacti.current = cacti.current
      .map((c) => ({ ...c, x: c.x - speed.current * dt }))
      .filter((c) => c.x > -CACTUS_WIDTH);

    // 4) Create a new cactus when the timer runs out
    timeToNextCactus.current -= dt;
    if (timeToNextCactus.current <= 0) {
      cacti.current.push({
        id: nextId.current++,
        x: widthRef.current,
        height: 34 + Math.random() * 26,
      });
      // Distance between cacti in pixels, converted to seconds using the current speed
      const gapInPixels = 300 + Math.random() * 300;
      timeToNextCactus.current = gapInPixels / speed.current;
    }

    // 5) Collision check (rectangles a little smaller than the drawings = fairer game)
    const dinoLeft = DINO_X + 8;
    const dinoRight = DINO_X + DINO_SIZE - 8;
    const hit = cacti.current.some(
      (c) => c.x < dinoRight && c.x + CACTUS_WIDTH > dinoLeft && dinoY.current < c.height - 6
    );

    if (hit) {
      status.current = 'over';
      if (score.current > bestScore.current) {
        bestScore.current = score.current;
      }
      forceRender();
      return;
    }

    forceRender();
    frameId.current = requestAnimationFrame((t) => tick.current(t));
  };

  // Stop the loop if the screen is closed
  useEffect(() => {
    return () => {
      if (frameId.current !== null) {
        cancelAnimationFrame(frameId.current);
      }
    };
  }, []);

  function startGame() {
    status.current = 'running';
    dinoY.current = 0;
    velocity.current = 0;
    cacti.current = [];
    speed.current = START_SPEED;
    score.current = 0;
    timeToNextCactus.current = 1;
    lastTime.current = 0;
    frameId.current = requestAnimationFrame((t) => tick.current(t));
    forceRender();
  }

  // One tap does everything: start, jump, or restart
  function handlePress() {
    if (status.current === 'ready' || status.current === 'over') {
      startGame();
    } else if (dinoY.current === 0) {
      velocity.current = JUMP_VELOCITY; // only jump when standing on the ground
    }
  }

  return (
    <TouchableWithoutFeedback onPress={handlePress}>
      <View style={styles.screen}>
        {/* Score */}
        <View style={styles.scoreBox}>
          <Text style={styles.scoreText}>HI {Math.floor(bestScore.current).toString().padStart(5, '0')}</Text>
          <Text style={styles.scoreText}>{Math.floor(score.current).toString().padStart(5, '0')}</Text>
        </View>

        {/* Messages */}
        {status.current === 'ready' && <Text style={styles.message}>TAP TO START</Text>}
        {status.current === 'over' && (
          <View style={styles.messageBox}>
            <Text style={styles.gameOver}>GAME OVER</Text>
            <Text style={styles.messageInline}>TAP TO RESTART</Text>
          </View>
        )}

        {/* Ground line */}
        <View style={styles.ground} />

        {/* Dinosaur (the emoji faces right; dinoY lifts it off the ground) */}
        <Text style={[styles.dino, { bottom: GROUND_HEIGHT + dinoY.current, left: DINO_X }]}>🦖</Text>

        {/* Cacti */}
        {cacti.current.map((c) => (
          <View key={c.id} style={[styles.cactus, { left: c.x, height: c.height }]} />
        ))}
      </View>
    </TouchableWithoutFeedback>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#f7f7f7' },
  scoreBox: { position: 'absolute', top: 60, right: 20, flexDirection: 'row', gap: 16 },
  scoreText: { fontSize: 18, fontWeight: 'bold', color: '#535353', fontVariant: ['tabular-nums'] },
  messageBox: { position: 'absolute', top: 160, width: '100%', alignItems: 'center' },
  gameOver: { fontSize: 30, fontWeight: 'bold', color: '#535353', marginBottom: 6 },
  message: { position: 'absolute', top: 180, width: '100%', textAlign: 'center', fontSize: 18, color: '#535353' },
  messageInline: { fontSize: 18, color: '#535353' },
  ground: { position: 'absolute', bottom: GROUND_HEIGHT - 2, left: 0, right: 0, height: 2, backgroundColor: '#535353' },
  dino: { position: 'absolute', fontSize: DINO_SIZE - 6, lineHeight: DINO_SIZE },
  cactus: {
    position: 'absolute',
    bottom: GROUND_HEIGHT,
    width: CACTUS_WIDTH,
    backgroundColor: '#2e7d32',
    borderTopLeftRadius: 10,
    borderTopRightRadius: 10,
  },
});
