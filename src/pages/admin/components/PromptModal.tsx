import React, { useState, useEffect } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../components/Button';
import { useCreatePrompt } from '../../../api/Api';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  day?: string;
  existingPrompt?: string;
  existingColors?: string[];
}

// Utility to convert HSL to HEX
function hslToHex(hsl: string): string {
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

const generateRandomColors = (): string[] => {
  const colors: string[] = [];

  for (let i = 0; i < 3; i++) {
    // Random hue (0-360), saturation (60-100%), lightness (40-70%)
    const hue = Math.floor(Math.random() * 360);
    const saturation = Math.floor(Math.random() * 41) + 60; // 60-100%
    const lightness = Math.floor(Math.random() * 31) + 40; // 40-70%
    const hsl = `hsl(${hue}, ${saturation}%, ${lightness}%)`;
    colors.push(hslToHex(hsl));
  }

  return colors;
};

export function PromptModal({
  isOpen,
  onClose,
  day,
  existingPrompt,
  existingColors,
}: PromptModalProps) {
  const [prompt, setPrompt] = useState('');
  const [colors, setColors] = useState<string[]>(generateRandomColors());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  const createPromptMutation = useCreatePrompt();

  // Reset form when modal opens/closes or when editing different prompt
  useEffect(() => {
    if (isOpen) {
      if (existingColors && existingColors.length === 3) {
        setColors(existingColors);
      } else {
        setColors(generateRandomColors());
      }
      setPrompt(existingPrompt || '');
      setError('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, existingPrompt, existingColors]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!day) return;

    setIsSubmitting(true);
    setError('');

    try {
      await createPromptMutation.mutateAsync({
        day,
        prompt,
        colors,
      });

      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save prompt');
    } finally {
      setIsSubmitting(false);
    }
  };

  const updateColor = (index: number, color: string) => {
    const newColors = [...colors];
    newColors[index] = color;
    setColors(newColors);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[9999]">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-primary">
            {existingPrompt ? 'Edit Prompt' : 'Add Prompt'}
          </h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Day Display */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-1">
              Date
            </label>
            <div className="text-primary font-medium">
              {day
                ? new Date(day).toLocaleDateString('en-US', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  })
                : 'Select a date'}
            </div>
          </div>

          {/* Prompt Input */}
          <div>
            <label
              htmlFor="prompt"
              className="block text-sm font-medium text-secondary mb-1"
            >
              Prompt
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Enter the drawing prompt..."
              className="w-full p-3 border border-border rounded-lg bg-background text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
              rows={3}
              required
            />
          </div>

          {/* Colors */}
          <div className="space-y-2">
            {colors.map((color, index) => {
              return (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="color"
                    value={color}
                    onChange={(e) => updateColor(index, e.target.value)}
                    className="w-12 h-10 border border-border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={color}
                    onChange={(e) => updateColor(index, e.target.value)}
                    placeholder="#000000"
                    className="flex-1 p-2 border border-border rounded bg-background text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              );
            })}
          </div>

          {/* Color Preview */}
          <div>
            <label className="block text-sm font-medium text-secondary mb-2">
              Preview
            </label>
            <div className="flex gap-2">
              {colors.map((color, index) => (
                <div
                  key={index}
                  className="w-8 h-8 rounded border border-border"
                  style={{ backgroundColor: color }}
                  title={color}
                />
              ))}
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-sm bg-red-500/10 p-3 rounded border border-red-500/20">
              {error}
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Button
              type="button"
              variant="base"
              onClick={onClose}
              disabled={isSubmitting}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              disabled={isSubmitting || !prompt.trim()}
              className="flex-1"
            >
              {isSubmitting
                ? 'Saving...'
                : existingPrompt
                  ? 'Update'
                  : 'Create'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
