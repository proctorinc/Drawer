import React, { useEffect, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faPlusCircle, faTimes } from '@fortawesome/free-solid-svg-icons';
import Button from '../../../components/Button';
import { useCreatePrompt, type User } from '../../../api/Api';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import { UserSelector } from './UserSelector';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import { generateRandomColors } from '../utils';

interface PromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  day?: string;
  existingPrompt?: string;
  existingColors?: Array<string>;
  existingCreatedBy?: User;
}

export function PromptModal({
  isOpen,
  onClose,
  day,
  existingPrompt,
  existingColors,
  existingCreatedBy,
}: PromptModalProps) {
  const { dashboardData } = useAdminDashboard();
  const [prompt, setPrompt] = useState('');
  const [colors, setColors] = useState<Array<string>>(generateRandomColors());
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [createdBy, setCreatedBy] = useState<User | undefined>(
    existingCreatedBy,
  );
  const [isUserSelectorOpen, setIsUserSelectorOpen] = useState(false);
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
        createdBy: createdBy?.id,
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
          {createdBy && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Created By
              </label>
              <div className="flex items-center gap-2">
                <UserProfileIcon
                  onClick={() => setIsUserSelectorOpen(true)}
                  user={createdBy}
                />
                <div className="text-primary font-medium">
                  {createdBy.username}
                </div>
                <button
                  type="button"
                  onClick={() => setCreatedBy(undefined)}
                  className="text-secondary hover:text-primary transition-colors"
                >
                  <FontAwesomeIcon icon={faTimes} />
                </button>
              </div>
            </div>
          )}
          {createdBy === undefined && (
            <div>
              <label className="block text-sm font-medium text-secondary mb-1">
                Created By
              </label>
              <Button
                type="button"
                icon={faPlusCircle}
                onClick={() => setIsUserSelectorOpen(true)}
              >
                Select User
              </Button>
            </div>
          )}

          {isUserSelectorOpen && dashboardData?.users && (
            <UserSelector
              users={dashboardData.users}
              onClose={() => setIsUserSelectorOpen(false)}
              onSelectUser={(user) => {
                setCreatedBy(user);
                setIsUserSelectorOpen(false);
              }}
            />
          )}

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
                <div key={index} className="flex flex-col gap-2">
                  {index === 3 && (
                    <span className="text-sm text-secondary">
                      Background color
                    </span>
                  )}
                  <div className="flex items-center gap-2">
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
                </div>
              );
            })}
            {colors.length < 4 && (
              <div className="flex flex-col gap-2">
                <span className="text-sm text-secondary">Add Background?</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value="#ffffff"
                    onChange={(e) => updateColor(colors.length, e.target.value)}
                    className="w-12 h-10 border border-border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value="#ffffff"
                    onChange={(e) => updateColor(colors.length, e.target.value)}
                    placeholder="#ffffff"
                    className="flex-1 p-2 border border-border rounded bg-background text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            )}
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
