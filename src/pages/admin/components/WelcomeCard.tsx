import { Card, CardContent } from '@/components/Card';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import type { HTMLAttributes } from 'react';

interface WelcomeCardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function WelcomeCard({ className = '', ...props }: WelcomeCardProps) {
  const { dashboardData } = useAdminDashboard();
  const admin = dashboardData?.admin || { id: '', username: '', email: '' };
  return (
    <Card className={className} {...props}>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 to-orange-500 rounded-full flex items-center justify-center">
              {/* crown icon */}
              <span
                role="img"
                aria-label="crown"
                className="text-white text-2xl"
              >
                👑
              </span>
            </div>
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold text-primary">
              Welcome, {admin.username}!
            </h2>
            <p className="text-secondary">
              You have full administrative access to the platform.
            </p>
            <p className="text-sm text-secondary/70 mt-1">{admin.email}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
