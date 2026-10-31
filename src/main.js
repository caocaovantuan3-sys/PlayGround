import { Game } from './game.js';
import { Save } from './save.js';

Save.load();

const game = new Game();
window.game = game;

// Prevent the page from scrolling / pulling to refresh during touch play.
document.addEventListener('touchmove', e => {
  if (e.target.closest('#touch-ui')) e.preventDefault();
}, { passive: false });

window.addEventListener('error', e => {
  console.error('[TITAN SLAYER] Uncaught error:', e.error || e.message);
});

window.addEventListener('unhandledrejection', e => {
  console.error('[TITAN SLAYER] Unhandled rejection:', e.reason);
});
