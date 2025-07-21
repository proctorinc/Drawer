import { Card, CardHeader, CardContent } from '@/components/Card';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import type { HTMLAttributes } from 'react';

interface RecentUsersCardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function RecentUsersCard({
  className = '',
  ...props
}: RecentUsersCardProps) {
  const { dashboardData } = useAdminDashboard();
  const recentUsers = dashboardData?.stats?.recentUsers || [];
  return (
    <Card className={className} {...props}>
      <CardContent>
        <CardHeader title="Recent Users" subtitle="Joined in the last 7 days" />
        <div className="space-y-2 max-h-60 overflow-y-auto">
          {recentUsers && recentUsers.length ? (
            recentUsers.map((user) => (
              <div
                key={user.ID}
                className="flex items-center gap-4 p-2 bg-primary/5 rounded-lg border border-border"
              >
                <div className="flex-1">
                  <div className="font-semibold text-primary">
                    {user.Username}
                  </div>
                  <div className="text-sm text-secondary">{user.Email}</div>
                </div>
                <div className="text-xs text-secondary/70">
                  {new Date(user.CreatedAt).toLocaleDateString()}
                </div>
              </div>
            ))
          ) : (
            <div className="text-center text-secondary py-4">
              No recent users
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
