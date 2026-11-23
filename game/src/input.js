// input.js — keyboard and mouse state

const keys = {};
const mouse = {
  x: 0,
  y: 0,
  dx: 0,
  dy: 0,
  left: false,
  right: false,
  locked: false,
};

export function initInput() {
  document.addEventListener('keydown', (e) => {
    keys[e.code] = true;
    if (e.code === 'Escape') {
      window.game?.togglePause();
    }
  });
  
  document.addEventListener('keyup', (e) => {
    keys[e.code] = false;
  });
  
  document.addEventListener('mousedown', (e) => {
    if (e.button === 0) mouse.left = true;
    if (e.button === 2) mouse.right = true;
    
    if (!mouse.locked && document.pointerLockElement === null) {
      document.body.requestPointerLock();
    }
  });
  
  document.addEventListener('mouseup', (e) => {
    if (e.button === 0) mouse.left = false;
    if (e.button === 2) mouse.right = false;
  });
  
  document.addEventListener('mousemove', (e) => {
    if (mouse.locked) {
      mouse.dx += e.movementX;
      mouse.dy += e.movementY;
    }
    mouse.x = e.clientX;
    mouse.y = e.clientY;
  });
  
  document.addEventListener('pointerlockchange', () => {
    mouse.locked = document.pointerLockElement !== null;
  });
  
  document.addEventListener('contextmenu', (e) => e.preventDefault());
}

export function isKeyDown(code) {
  return keys[code] === true;
}

export function getMouseDelta() {
  const dx = mouse.dx;
  const dy = mouse.dy;
  mouse.dx = 0;
  mouse.dy = 0;
  return { dx, dy };
}

export function isMouseDown(button) {
  if (button === 'left') return mouse.left;
  if (button === 'right') return mouse.right;
  return false;
}

export function isMouseLocked() {
  return mouse.locked;
}
