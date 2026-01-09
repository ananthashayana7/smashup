
import { Vector2D, PhysicsState } from '../types';
import { FRICTION, BOUNCE_FACTOR } from '../constants';

export const rotateVector = (v: Vector2D, angle: number): Vector2D => {
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  return {
    x: v.x * cos - v.y * sin,
    y: v.x * sin + v.y * cos
  };
};

export const getDistance = (v1: Vector2D, v2: Vector2D): number => {
  return Math.sqrt((v1.x - v2.x) ** 2 + (v1.y - v2.y) ** 2);
};

export const applyFriction = (vel: Vector2D): Vector2D => {
  return {
    x: vel.x * FRICTION,
    y: vel.y * FRICTION
  };
};

export const handleWallCollision = (state: PhysicsState, width: number, height: number, margin: number = 20): PhysicsState => {
  const newState = { ...state };
  if (newState.pos.x < margin) {
    newState.pos.x = margin;
    newState.vel.x *= -BOUNCE_FACTOR;
  } else if (newState.pos.x > width - margin) {
    newState.pos.x = width - margin;
    newState.vel.x *= -BOUNCE_FACTOR;
  }

  if (newState.pos.y < margin) {
    newState.pos.y = margin;
    newState.vel.y *= -BOUNCE_FACTOR;
  } else if (newState.pos.y > height - margin) {
    newState.pos.y = height - margin;
    newState.vel.y *= -BOUNCE_FACTOR;
  }
  return newState;
};
