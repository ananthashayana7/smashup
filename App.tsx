
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { 
  GameStatus, 
  PhysicsState, 
  CarStats, 
  Vector2D, 
  Particle,
  TrailPoint,
  GameEvent 
} from './types';
import { 
  WORLD_WIDTH, 
  WORLD_HEIGHT, 
  CAR_WIDTH, 
  CAR_HEIGHT, 
  MAX_HEALTH, 
  MAX_TURBO,
  TURBO_REGEN,
  TURBO_DRAIN,
  COLORS, 
  DAMAGE_MULTIPLIER,
  COLLISION_DAMAGE_THRESHOLD
} from './constants';
import { updateCarPhysics, getAIInputs } from './engine/CarController';
import { handleWallCollision, getDistance } from './engine/Physics';
import { getDerbyCommentary } from './services/geminiService';

const App: React.FC = () => {
  const [status, setStatus] = useState<GameStatus>(GameStatus.MENU);
  const [commentary, setCommentary] = useState("Welcome to the Neon Smash Arena!");
  const [screenShake, setScreenShake] = useState(0);
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Fix: Added initial value undefined to satisfy useRef expectation of 1 argument
  const requestRef = useRef<number | undefined>(undefined);
  
  // Game Entities
  const carsRef = useRef<{ stats: CarStats, physics: PhysicsState, trails: TrailPoint[] }[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const keysRef = useRef<{ [key: string]: boolean }>({});
  const lastCommentaryTime = useRef(0);

  const initGame = () => {
    carsRef.current = [
      {
        stats: { id: 'player', name: 'You', color: COLORS.PLAYER, health: MAX_HEALTH, maxHealth: MAX_HEALTH, turbo: MAX_TURBO, maxTurbo: MAX_TURBO, score: 0, isPlayer: true, isDead: false },
        physics: { pos: { x: 200, y: 400 }, vel: { x: 0, y: 0 }, angle: 0, angularVel: 0, mass: 1 },
        trails: []
      },
      {
        stats: { id: 'ai1', name: 'Red Fury', color: COLORS.ENEMY_1, health: MAX_HEALTH, maxHealth: MAX_HEALTH, turbo: MAX_TURBO, maxTurbo: MAX_TURBO, score: 0, isPlayer: false, isDead: false },
        physics: { pos: { x: 1000, y: 200 }, vel: { x: 0, y: 0 }, angle: Math.PI, angularVel: 0, mass: 1 },
        trails: []
      },
      {
        stats: { id: 'ai2', name: 'Amber Hulk', color: COLORS.ENEMY_2, health: MAX_HEALTH, maxHealth: MAX_HEALTH, turbo: MAX_TURBO, maxTurbo: MAX_TURBO, score: 0, isPlayer: false, isDead: false },
        physics: { pos: { x: 1000, y: 600 }, vel: { x: 0, y: 0 }, angle: Math.PI, angularVel: 0, mass: 1 },
        trails: []
      },
      {
        stats: { id: 'ai3', name: 'Pink Ghost', color: COLORS.ENEMY_3, health: MAX_HEALTH, maxHealth: MAX_HEALTH, turbo: MAX_TURBO, maxTurbo: MAX_TURBO, score: 0, isPlayer: false, isDead: false },
        physics: { pos: { x: 600, y: 100 }, vel: { x: 0, y: 0 }, angle: Math.PI / 2, angularVel: 0, mass: 1 },
        trails: []
      }
    ];
    particlesRef.current = [];
    setCommentary("Match Start! Go for the kill!");
    setStatus(GameStatus.PLAYING);
  };

  const spawnParticles = (x: number, y: number, color: string, count: number, speed: number = 10) => {
    for (let i = 0; i < count; i++) {
      particlesRef.current.push({
        x, y,
        vx: (Math.random() - 0.5) * speed,
        vy: (Math.random() - 0.5) * speed,
        life: 0,
        maxLife: 15 + Math.random() * 25,
        color,
        size: 1 + Math.random() * 4
      });
    }
  };

  const triggerCommentary = async (event: GameEvent) => {
    const now = Date.now();
    if (now - lastCommentaryTime.current < 5000) return;
    lastCommentaryTime.current = now;
    const text = await getDerbyCommentary(event);
    setCommentary(text);
  };

  const resolveCollisions = () => {
    const cars = carsRef.current;
    for (let i = 0; i < cars.length; i++) {
      if (cars[i].stats.isDead) continue;
      for (let j = i + 1; j < cars.length; j++) {
        if (cars[j].stats.isDead) continue;

        const dist = getDistance(cars[i].physics.pos, cars[j].physics.pos);
        const minDist = CAR_WIDTH * 0.85;

        if (dist < minDist) {
          const dx = cars[i].physics.pos.x - cars[j].physics.pos.x;
          const dy = cars[i].physics.pos.y - cars[j].physics.pos.y;
          const angle = Math.atan2(dy, dx);
          
          const relVel = Math.sqrt(
            (cars[i].physics.vel.x - cars[j].physics.vel.x) ** 2 + 
            (cars[i].physics.vel.y - cars[j].physics.vel.y) ** 2
          );
          
          if (relVel > COLLISION_DAMAGE_THRESHOLD) {
            const damage = relVel * DAMAGE_MULTIPLIER;
            cars[i].stats.health -= damage;
            cars[j].stats.health -= damage;
            
            setScreenShake(Math.min(20, relVel * 2));
            spawnParticles(
              (cars[i].physics.pos.x + cars[j].physics.pos.x) / 2,
              (cars[i].physics.pos.y + cars[j].physics.pos.y) / 2,
              '#fff',
              Math.floor(relVel * 4),
              relVel
            );

            if (relVel > 6) {
              triggerCommentary({
                type: 'CRASH',
                participants: [cars[i].stats.name, cars[j].stats.name],
                intensity: relVel
              });
            }
          }

          // Elastic collision response
          const pushX = Math.cos(angle) * (minDist - dist) * 0.6;
          const pushY = Math.sin(angle) * (minDist - dist) * 0.6;

          cars[i].physics.pos.x += pushX;
          cars[i].physics.pos.y += pushY;
          cars[j].physics.pos.x -= pushX;
          cars[j].physics.pos.y -= pushY;

          const tempVel = { ...cars[i].physics.vel };
          cars[i].physics.vel = { x: cars[j].physics.vel.x * 0.9, y: cars[j].physics.vel.y * 0.9 };
          cars[j].physics.vel = { x: tempVel.x * 0.9, y: tempVel.y * 0.9 };
        }
      }
    }
  };

  const update = useCallback(() => {
    if (status !== GameStatus.PLAYING) return;

    const player = carsRef.current.find(c => c.stats.isPlayer);
    
    carsRef.current.forEach((car) => {
      if (car.stats.isDead) return;

      if (car.stats.health <= 0) {
        car.stats.isDead = true;
        setScreenShake(25);
        spawnParticles(car.physics.pos.x, car.physics.pos.y, car.stats.color, 50, 15);
        spawnParticles(car.physics.pos.x, car.physics.pos.y, '#fbbf24', 20, 10); // fire/sparks
        
        triggerCommentary({
          type: 'KILL',
          participants: [car.stats.name],
          intensity: 10
        });

        if (car.stats.isPlayer) {
          setTimeout(() => setStatus(GameStatus.GAMEOVER), 2000);
        }
        return;
      }

      let inputs;
      if (car.stats.isPlayer) {
        inputs = {
          forward: keysRef.current['ArrowUp'] || keysRef.current['w'],
          backward: keysRef.current['ArrowDown'] || keysRef.current['s'],
          left: keysRef.current['ArrowLeft'] || keysRef.current['a'],
          right: keysRef.current['ArrowRight'] || keysRef.current['d'],
          turbo: !!keysRef.current['Shift']
        };
      } else {
        inputs = getAIInputs(car.physics, player?.stats.isDead ? null : player?.physics || null);
      }

      const isBoosting = inputs.turbo && car.stats.turbo > 0;
      if (isBoosting) {
        car.stats.turbo = Math.max(0, car.stats.turbo - TURBO_DRAIN);
        // Turbo sparks
        if (Math.random() > 0.5) {
          spawnParticles(car.physics.pos.x, car.physics.pos.y, COLORS.TURBO, 2, 5);
        }
      } else {
        car.stats.turbo = Math.min(car.stats.maxTurbo, car.stats.turbo + TURBO_REGEN);
      }

      car.physics = updateCarPhysics(car.physics, inputs, car.stats.turbo > 0);
      car.physics = handleWallCollision(car.physics, WORLD_WIDTH, WORLD_HEIGHT);

      // Tire trails
      const speed = Math.sqrt(car.physics.vel.x ** 2 + car.physics.vel.y ** 2);
      if (speed > 3) {
        car.trails.push({ x: car.physics.pos.x, y: car.physics.pos.y, life: 60 });
      }
      car.trails = car.trails.filter(t => {
        t.life--;
        return t.life > 0;
      });
    });

    resolveCollisions();

    // Update particles
    particlesRef.current = particlesRef.current.filter(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.life++;
      return p.life < p.maxLife;
    });

    if (screenShake > 0) setScreenShake(prev => prev * 0.9);

    // Check Victory
    const aliveAI = carsRef.current.filter(c => !c.stats.isPlayer && !c.stats.isDead);
    if (aliveAI.length === 0 && player && !player.stats.isDead) {
      setStatus(GameStatus.GAMEOVER);
      setCommentary("CHAMPION! You are the King of the Derby!");
    }

    draw();
    requestRef.current = requestAnimationFrame(update);
  }, [status, screenShake]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    if (screenShake > 0.1) {
      ctx.translate((Math.random() - 0.5) * screenShake, (Math.random() - 0.5) * screenShake);
    }

    // BG
    ctx.fillStyle = COLORS.ARENA;
    ctx.fillRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);

    // Grid
    ctx.strokeStyle = COLORS.GRID;
    ctx.lineWidth = 1;
    for (let x = 0; x < WORLD_WIDTH; x += 100) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, WORLD_HEIGHT);
      ctx.stroke();
    }
    for (let y = 0; y < WORLD_HEIGHT; y += 100) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(WORLD_WIDTH, y);
      ctx.stroke();
    }

    // Trails
    carsRef.current.forEach(car => {
      if (car.trails.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = car.stats.color;
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 10]);
      for (let i = 0; i < car.trails.length; i++) {
        const p = car.trails[i];
        ctx.globalAlpha = (p.life / 60) * 0.3;
        if (i === 0) ctx.moveTo(p.x, p.y);
        else ctx.lineTo(p.x, p.y);
      }
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.globalAlpha = 1.0;
    });

    // Particles
    particlesRef.current.forEach(p => {
      ctx.fillStyle = p.color;
      ctx.globalAlpha = 1 - p.life / p.maxLife;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1.0;

    // Cars
    carsRef.current.forEach(car => {
      if (car.stats.isDead) return;

      ctx.save();
      ctx.translate(car.physics.pos.x, car.physics.pos.y);
      ctx.rotate(car.physics.angle);

      // Body
      ctx.fillStyle = car.stats.color;
      ctx.shadowBlur = 10;
      ctx.shadowColor = car.stats.color;
      ctx.fillRect(-CAR_WIDTH / 2, -CAR_HEIGHT / 2, CAR_WIDTH, CAR_HEIGHT);
      ctx.shadowBlur = 0;
      
      // Details
      ctx.fillStyle = '#111';
      ctx.fillRect(2, -CAR_HEIGHT / 2 + 3, 10, CAR_HEIGHT - 6); // windshield
      
      // Turbo flames
      const speed = Math.sqrt(car.physics.vel.x ** 2 + car.physics.vel.y ** 2);
      if (speed > 8) {
        ctx.fillStyle = COLORS.TURBO;
        ctx.fillRect(-CAR_WIDTH / 2 - 10 - Math.random() * 5, -5, 10, 10);
      }

      ctx.restore();

      // Mini Health/Turbo Bars
      const bW = 50;
      ctx.fillStyle = 'rgba(0,0,0,0.5)';
      ctx.fillRect(car.physics.pos.x - bW / 2, car.physics.pos.y - 35, bW, 10);
      
      // HP
      ctx.fillStyle = '#ef4444';
      ctx.fillRect(car.physics.pos.x - bW / 2, car.physics.pos.y - 35, bW * (car.stats.health / MAX_HEALTH), 4);
      // Turbo
      ctx.fillStyle = COLORS.TURBO;
      ctx.fillRect(car.physics.pos.x - bW / 2, car.physics.pos.y - 30, bW * (car.stats.turbo / MAX_TURBO), 2);
    });

    // Border
    ctx.strokeStyle = '#334155';
    ctx.lineWidth = 10;
    ctx.strokeRect(5, 5, WORLD_WIDTH - 10, WORLD_HEIGHT - 10);

    ctx.restore();
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { keysRef.current[e.key] = true; };
    const handleKeyUp = (e: KeyboardEvent) => { keysRef.current[e.key] = false; };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, []);

  useEffect(() => {
    if (status === GameStatus.PLAYING) {
      requestRef.current = requestAnimationFrame(update);
    }
    return () => {
      if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [status, update]);

  const playerStats = carsRef.current.find(c => c.stats.isPlayer)?.stats;

  return (
    <div className="relative w-screen h-screen flex flex-col items-center justify-center bg-slate-950 select-none overflow-hidden font-mono">
      {/* HUD */}
      <div className="absolute top-0 left-0 w-full p-6 flex justify-between items-start pointer-events-none z-10">
        <div className="flex flex-col gap-2">
          <div className="bg-slate-900/90 p-4 border-l-4 border-blue-500 backdrop-blur-md shadow-xl">
            <h1 className="text-xl font-black italic tracking-tighter text-white">
              NEON <span className="text-blue-500">DERBY</span>
            </h1>
            <div className="mt-2 flex flex-col gap-1 w-48">
              <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold">
                <span>Hull Integrity</span>
                <span>{Math.max(0, Math.round(playerStats?.health || 0))}%</span>
              </div>
              <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-blue-500 transition-all duration-200" 
                  style={{ width: `${Math.max(0, playerStats?.health || 0)}%` }}
                />
              </div>
              
              <div className="flex justify-between text-[10px] text-slate-400 uppercase font-bold mt-1">
                <span>Nitro System</span>
                <span>{Math.round(playerStats?.turbo || 0)}%</span>
              </div>
              <div className="h-1.5 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className="h-full bg-cyan-400 transition-all duration-100" 
                  style={{ width: `${playerStats?.turbo || 0}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="max-w-sm">
          <div className="bg-slate-900/90 p-4 border-r-4 border-slate-500 backdrop-blur-md shadow-xl text-right">
            <div className="text-[10px] text-slate-500 uppercase font-bold mb-1 tracking-widest">Global Feed</div>
            <p className="text-white italic text-xs leading-relaxed opacity-90">
              "{commentary}"
            </p>
          </div>
        </div>
      </div>

      {/* Main Game Container */}
      <div className="relative rounded shadow-[0_0_50px_rgba(0,0,0,0.5)] border-8 border-slate-900">
        <canvas 
          ref={canvasRef} 
          width={WORLD_WIDTH} 
          height={WORLD_HEIGHT}
          className="max-w-full max-h-[85vh] object-contain block bg-slate-950"
        />
        
        {status === GameStatus.MENU && (
          <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center p-8 backdrop-blur-sm">
            <div className="text-center space-y-2 mb-12">
              <h2 className="text-7xl font-black italic tracking-tighter text-white drop-shadow-[0_0_15px_rgba(59,130,246,0.6)]">
                SMASH UP
              </h2>
              <div className="text-2xl font-bold text-blue-500 tracking-[0.5em] uppercase">Neon Arena</div>
            </div>
            
            <div className="grid grid-cols-2 gap-8 max-w-2xl mb-12 text-slate-400 text-xs uppercase tracking-widest text-center">
              <div className="bg-slate-900/50 p-4 rounded border border-slate-800">
                <div className="text-white font-bold mb-2">Controls</div>
                WASD / Arrows - Move<br/>Shift - Turbo Boost
              </div>
              <div className="bg-slate-900/50 p-4 rounded border border-slate-800">
                <div className="text-white font-bold mb-2">Strategy</div>
                Hitting sides/rear deals massive damage. Avoid head-on collisions!
              </div>
            </div>

            <button 
              onClick={initGame}
              className="group relative px-12 py-5 bg-blue-600 hover:bg-blue-500 text-white font-black rounded italic transition-all active:scale-95 overflow-hidden"
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-500" />
              ENTER THE ARENA
            </button>
          </div>
        )}

        {status === GameStatus.GAMEOVER && (
          <div className="absolute inset-0 bg-slate-950/90 flex flex-col items-center justify-center space-y-6 backdrop-blur-lg animate-in fade-in duration-500">
            <h2 className={`text-8xl font-black italic tracking-tighter ${playerStats?.isDead ? "text-red-500" : "text-green-500"}`}>
              {playerStats?.isDead ? "TOTALED" : "VICTORIOUS"}
            </h2>
            <p className="text-slate-400 uppercase tracking-[1em] text-sm">Session Terminated</p>
            
            <div className="flex gap-4">
              <button 
                onClick={initGame}
                className="px-10 py-4 bg-white text-slate-950 font-black rounded italic hover:bg-slate-200 transition-all"
              >
                RE-REGENERATE
              </button>
              <button 
                onClick={() => setStatus(GameStatus.MENU)}
                className="px-10 py-4 border-2 border-slate-700 text-white font-black rounded italic hover:bg-slate-800 transition-all"
              >
                EXIT
              </button>
            </div>
          </div>
        )}
      </div>

      <div className="mt-6 flex gap-8 text-[10px] text-slate-600 uppercase tracking-widest font-bold">
        <span>Model: Gemini 3 Flash Preview</span>
        <span>•</span>
        <span>Neural Commentary Engine: Active</span>
        <span>•</span>
        <span>Physics: 60FPS Sync</span>
      </div>
    </div>
  );
};

export default App;
