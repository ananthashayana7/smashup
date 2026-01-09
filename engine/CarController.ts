
import { PhysicsState, CarStats, Vector2D } from '../types';
import { 
  ACCELERATION, 
  TURBO_ACCELERATION,
  STEERING_SPEED, 
  AI_DETECTION_RANGE,
  AI_TURBO_THRESHOLD
} from '../constants';
import { applyFriction } from './Physics';

export const updateCarPhysics = (
  state: PhysicsState, 
  inputs: { forward: boolean, backward: boolean, left: boolean, right: boolean, turbo: boolean },
  canTurbo: boolean
): PhysicsState => {
  const newState = { ...state };
  
  const speed = Math.sqrt(newState.vel.x ** 2 + newState.vel.y ** 2);
  const isMoving = speed > 0.1;
  const isMovingForward = (newState.vel.x * Math.cos(newState.angle) + newState.vel.y * Math.sin(newState.angle)) > 0;

  // Steering
  if (isMoving) {
    const steerDir = isMovingForward ? 1 : -1;
    // Steering is harder at high speeds
    const steerFactor = Math.min(1.2, 0.5 + speed / 15);
    if (inputs.left) newState.angle -= STEERING_SPEED * steerFactor * steerDir;
    if (inputs.right) newState.angle += STEERING_SPEED * steerFactor * steerDir;
  }

  // Acceleration
  const currentAccel = (inputs.turbo && canTurbo) ? TURBO_ACCELERATION : ACCELERATION;
  
  if (inputs.forward) {
    newState.vel.x += Math.cos(newState.angle) * currentAccel;
    newState.vel.y += Math.sin(newState.angle) * currentAccel;
  }
  if (inputs.backward) {
    newState.vel.x -= Math.cos(newState.angle) * (ACCELERATION * 0.5);
    newState.vel.y -= Math.sin(newState.angle) * (ACCELERATION * 0.5);
  }

  // Friction
  newState.vel = applyFriction(newState.vel);
  
  // Position update
  newState.pos.x += newState.vel.x;
  newState.pos.y += newState.vel.y;

  return newState;
};

export const getAIInputs = (
  aiState: PhysicsState, 
  targetState: PhysicsState | null
) => {
  if (!targetState) return { forward: false, backward: false, left: false, right: false, turbo: false };

  const dx = targetState.pos.x - aiState.pos.x;
  const dy = targetState.pos.y - aiState.pos.y;
  const dist = Math.sqrt(dx * dx + dy * dy);
  
  if (dist > AI_DETECTION_RANGE) return { forward: true, backward: false, left: false, right: false, turbo: false };

  const targetAngle = Math.atan2(dy, dx);
  let angleDiff = targetAngle - aiState.angle;
  
  while (angleDiff < -Math.PI) angleDiff += Math.PI * 2;
  while (angleDiff > Math.PI) angleDiff -= Math.PI * 2;

  const threshold = 0.15;
  const isLinedUp = Math.abs(angleDiff) < 0.3;

  return {
    forward: true,
    backward: false,
    left: angleDiff < -threshold,
    right: angleDiff > threshold,
    turbo: isLinedUp && dist < AI_TURBO_THRESHOLD
  };
};
