import { Config } from '@/config/Config';

export const createCursorImage = (color: string | null) => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  if (ctx) {
    canvas.width = Config.CURSOR_SIZE;
    canvas.height = Config.CURSOR_SIZE;
    ctx.fillStyle = color ?? 'lightgray';
    ctx.beginPath();
    ctx.arc(
      Config.CURSOR_SIZE / 2,
      Config.CURSOR_SIZE / 2,
      Config.CURSOR_SIZE / 2,
      0,
      Math.PI * 2,
    ); // Draw a circle
    ctx.fill();
  }

  return canvas.toDataURL();
};
