import './style.css';
import { Game } from './game/Game.ts';

async function main(): Promise<void> {
  const game = new Game();
  await game.init();
}

main().catch(console.error);
