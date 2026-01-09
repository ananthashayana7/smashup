
export interface Vector2D {
  x: number;
  y: number;
}

export enum GameStatus {
  MENU = 'MENU',
  PLAYING = 'PLAYING',
  GAMEOVER = 'GAMEOVER',
  PAUSED = 'PAUSED'
}

export interface CarStats {
  id: string;
  name: string;
  color: string;
  health: number;
  maxHealth: number;
  turbo: number;
  maxTurbo: number;
  score: number;
  isPlayer: boolean;
  isDead: boolean;
}

export interface PhysicsState {
  pos: Vector2D;
  vel: Vector2D;
  angle: number;
  angularVel: number;
  mass: number;
}

export interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

export interface TrailPoint {
  x: number;
  y: number;
  life: number;
}

export interface GameEvent {
  type: 'CRASH' | 'KILL' | 'START' | 'VICTORY' | 'TURBO';
  participants: string[];
  intensity: number;
}
