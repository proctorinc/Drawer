import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import {
  faCalendar,
  faExclamationTriangle,
  faPlus,
  faEdit,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import type { HTMLAttributes } from 'react';
import { cn } from '@/utils';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import type { User } from '@/api/Api';

interface FuturePromptsCardProps extends HTMLAttributes<HTMLDivElement> {
  openModal: (
    day: string,
    prompt?: string,
    colors?: Array<string>,
    createdBy?: User,
  ) => void;
  className?: string;
}

export function FuturePromptsCard({
  openModal,
  className = '',
  ...props
}: FuturePromptsCardProps) {
  const { dashboardData } = useAdminDashboard();
  const futurePrompts = dashboardData?.futurePrompts || [];
  // Generate list of days from today to the last prompt day
  const today = new Date();
  if (futurePrompts.length === 0) {
    return (
      <Card className="col-span-2">
        <CardContent>
          <CardHeader
            title="Daily Prompts"
            subtitle="Manage upcoming daily prompts"
          />
          <div className="text-center py-8 text-secondary">
            No future prompts found.
          </div>
        </CardContent>
      </Card>
    );
  }
  const lastPromptDay = futurePrompts[futurePrompts.length - 1];
  const lastDate = new Date(lastPromptDay.day);
  const promptMap = new Map();
  futurePrompts.forEach((prompt) => {
    promptMap.set(prompt.day, prompt);
  });
  const allDays = [];
  const currentDate = new Date(today);
  currentDate.setHours(0, 0, 0, 0);
  while (currentDate <= lastDate) {
    const dayStr = currentDate.toISOString().split('T')[0];
    const prompt = promptMap.get(dayStr);
    allDays.push({
      day: dayStr,
      prompt,
      hasPrompt: !!prompt,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }
  return (
    <Card className={cn('h-fit', className)} {...props}>
      <CardContent>
        <CardHeader
          title="Daily Prompts"
          subtitle="Manage upcoming daily prompts"
        />
        <div className="space-y-3 max-h-[700px] overflow-y-auto">
          {allDays.map(({ day, prompt, hasPrompt }) => (
            <div
              key={day}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                hasPrompt
                  ? 'bg-primary/5 border-border'
                  : 'bg-red-500/10 border-red-500/30'
              }`}
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <FontAwesomeIcon
                    icon={hasPrompt ? faCalendar : faExclamationTriangle}
                    className={hasPrompt ? 'text-primary' : 'text-red-500'}
                  />
                  <h4
                    className={`font-semibold ${hasPrompt ? 'text-primary' : 'text-red-500'}`}
                  >
                    {new Date(day).toLocaleDateString('en-US', {
                      weekday: 'short',
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </h4>
                  {!hasPrompt && (
                    <span className="text-xs bg-red-500 text-white px-2 py-1 rounded">
                      Missing Prompt
                    </span>
                  )}
                </div>
                <div className="flex gap-5">
                  {hasPrompt ? (
                    <div className="mt-2">
                      <p className="text-sm text-secondary mb-2">
                        {prompt.prompt}
                      </p>
                      <div className="flex gap-2">
                        {prompt.colors.map((color: string, index: number) => (
                          <div
                            key={index}
                            className="w-4 h-4 rounded border border-border"
                            style={{ backgroundColor: color }}
                            title={color}
                          />
                        ))}
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm text-red-500/70 mt-1">
                      No prompt scheduled for this day
                    </p>
                  )}
                  {prompt?.createdBy && (
                    <UserProfileIcon user={prompt.createdBy} size="sm" />
                  )}
                </div>
              </div>
              {/* Action Buttons */}
              <div className="flex gap-2 ml-4">
                {hasPrompt ? (
                  <Button
                    variant="base"
                    size="sm"
                    icon={faEdit}
                    onClick={() =>
                      openModal(
                        day,
                        prompt.prompt,
                        prompt.colors,
                        prompt.createdBy,
                      )
                    }
                    className="text-primary hover:text-primary/80"
                  >
                    Edit
                  </Button>
                ) : (
                  <Button
                    variant="primary"
                    size="sm"
                    icon={faPlus}
                    onClick={() => openModal(day)}
                    className="text-white"
                  >
                    Add
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
