import { Card, CardHeader, CardContent } from '@/components/Card';
import type { HTMLAttributes } from 'react';

interface RecentActivityCardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function RecentActivityCard({
  className = '',
  ...props
}: RecentActivityCardProps) {
  return (
    <Card className={className} {...props}>
      <CardContent>
        <CardHeader title="Recent Activity" subtitle="Latest platform events" />
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg">
            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">
                New user registered
              </p>
              <p className="text-xs text-secondary">2 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg">
            <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">
                Daily prompt completed
              </p>
              <p className="text-xs text-secondary">5 minutes ago</p>
            </div>
          </div>
          <div className="flex items-center gap-3 p-2 bg-primary/5 rounded-lg">
            <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
            <div className="flex-1">
              <p className="text-sm font-medium text-primary">
                System maintenance
              </p>
              <p className="text-xs text-secondary">1 hour ago</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
