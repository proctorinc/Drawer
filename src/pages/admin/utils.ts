// Utility to convert HSL to HEX
export function hslToHex(hsl: string): string {
  const match = hsl.match(/^hsl\((\d+),\s*(\d+)%?,\s*(\d+)%?\)$/);
  if (!match) return '#ffffff';
  const h = Number(match[1]);
  const s = Number(match[2]) / 100;
  const l = Number(match[3]) / 100;

  let r: number, g: number, b: number;

  if (s === 0) {
    r = g = b = l;
  } else {
    const hue2rgb = (p: number, q: number, t: number) => {
      if (t < 0) t += 1;
      if (t > 1) t -= 1;
      if (t < 1 / 6) return p + (q - p) * 6 * t;
      if (t < 1 / 2) return q;
      if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
      return p;
    };
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h / 360 + 1 / 3);
    g = hue2rgb(p, q, h / 360);
    b = hue2rgb(p, q, h / 360 - 1 / 3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255)
      .toString(16)
      .padStart(2, '0');
    return hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

export const generateRandomColors = (): Array<string> => {
  const colors: Array<string> = [];

  for (let i = 0; i < 4; i++) {
    // Random hue (0-360), saturation (60-100%), lightness (40-70%)
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 41) + 60; // 60-100%
    const lightness = Math.floor(Math.random() * 31) + 40; // 40-70%
    const hsl = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    colors.push(hslToHex(hsl));
  }

  return colors;
};
