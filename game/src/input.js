// Keyboard and mouse. One job: turn raw events into a stable, testable
// input state with edge detection (pressed this frame).

import { KEYS } from './config.js';

export class Input {
  constructor() {
    this.down = new Set();
    this.pressed = new Set();
    this.mouse = { x: 0, y: 0, clicked: false };
    this.anyKey = false;
    this._onKeyDown = (e) => {
      if (e.repeat) return;
      this.down.add(e.code);
      this.pressed.add(e.code);
      this.anyKey = true;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
        e.preventDefault();
      }
    };
    this._onKeyUp = (e) => this.down.delete(e.code);
    this._onMouse = (e) => {
      const r = e.target.getBoundingClientRect();
      this.mouse.x = e.clientX - r.left;
      this.mouse.y = e.clientY - r.top;
      this.mouse.clicked = true;
    };
    this._onBlur = () => this.down.clear();
  }

  attach(el) {
    window.addEventListener('keydown', this._onKeyDown);
    window.addEventListener('keyup', this._onKeyUp);
    window.addEventListener('blur', this._onBlur);
    el.addEventListener('mousedown', this._onMouse);
  }

  detach() {
    window.removeEventListener('keydown', this._onKeyDown);
    window.removeEventListener('keyup', this._onKeyUp);
    window.removeEventListener('blur', this._onBlur);
  }

  held(action) {
    return KEYS[action].some((c) => this.down.has(c));
  }

  wasPressed(action) {
    return KEYS[action].some((c) => this.pressed.has(c));
  }

  axis() {
    const x = (this.held('right') ? 1 : 0) - (this.held('left') ? 1 : 0);
    const y = (this.held('down') ? 1 : 0) - (this.held('up') ? 1 : 0);
    return { x, y };
  }

  // Call at the end of each frame: edges live for one frame only.
  endFrame() {
    this.pressed.clear();
    this.mouse.clicked = false;
    this.anyKey = false;
  }
}
