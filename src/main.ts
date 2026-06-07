import "./ui/styles.css";
import { Game } from "./Game";

const canvas = document.getElementById("game-canvas") as HTMLCanvasElement;
const uiRoot = document.getElementById("ui-root") as HTMLElement;

if (!canvas || !uiRoot) {
  throw new Error("VEILBORN: missing #game-canvas or #ui-root in index.html");
}

const game = new Game(canvas, uiRoot);
game.start();

// Dev-only debug handle for inspection/automated checks.
if (import.meta.env.DEV) {
  (window as unknown as { veilborn: Game }).veilborn = game;
}
