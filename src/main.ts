import './style.css';
import { Game } from './game/Game.ts';

async function main(): Promise<void> {
  const game = new Game();
  await game.init();
}

main().catch(error => {
  console.error(error);
  showFatalError(error);
});

function showFatalError(error: unknown): void {
  const app = document.getElementById('app') ?? document.body;
  const message = error instanceof Error ? error.message : String(error);
  app.innerHTML = '';
  app.classList.add('fatal-error');
  app.textContent = `RESOURCE ASSERTION FAILED\n\n${message}`;
}
