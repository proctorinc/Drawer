import { Card, CardContent } from '@/components/Card';
import {
  faUsers,
  faChartLine,
  faHeart,
  faComment,
} from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import type { HTMLAttributes } from 'react';
import { cn } from '@/utils';

interface StatsCardsProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
}

export function TotalStatsCards({ className = '', ...props }: StatsCardsProps) {
  const { dashboardData } = useAdminDashboard();
  const stats = dashboardData?.stats || {
    overall: {
      totalUsers: 0,
      totalDrawings: 0,
      totalReactions: 0,
      totalComments: 0,
    },
  };
  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <Card>
        <CardContent className="text-center gap-2">
          <div className="flex gap-3 w-full justify-center items-center">
            <div className="gap-3 w-12 h-12 bg-blue-500 text-shadow-white rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faUsers} className="text-white text-lg" />
            </div>
            <h3 className="text-primary text-lg font-bold">Total Users</h3>
          </div>
          <p className="text-5xl font-extrabold text-primary">
            {stats.overall.totalUsers ?? '-'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="text-center gap-2">
          <div className="flex gap-3 w-full justify-center items-center">
            <div className="gap-3 w-12 h-12 bg-green-500 text-shadow-white rounded-full flex items-center justify-center">
              <FontAwesomeIcon
                icon={faChartLine}
                className="text-white text-lg"
              />
            </div>
            <h3 className="text-primary text-lg font-bold">Total Drawings</h3>
          </div>
          <p className="text-5xl font-extrabold text-primary">
            {stats.overall.totalDrawings ?? '-'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="text-center gap-2">
          <div className="flex gap-3 w-full justify-center items-center">
            <div className="gap-3 w-12 h-12 bg-red-400 text-shadow-white rounded-full flex items-center justify-center">
              <FontAwesomeIcon icon={faHeart} className="text-white text-lg" />
            </div>
            <h3 className="text-primary text-lg font-bold">Total Reactions</h3>
          </div>
          <p className="text-5xl font-extrabold text-primary">
            {stats.overall.totalReactions ?? '-'}
          </p>
        </CardContent>
      </Card>
      <Card>
        <CardContent className="text-center gap-2">
          <div className="flex gap-3 w-full justify-center items-center">
            <div className="gap-3 w-12 h-12 bg-yellow-400 text-shadow-white rounded-full flex items-center justify-center">
              <FontAwesomeIcon
                icon={faComment}
                className="text-white text-lg"
              />
            </div>
            <h3 className="text-primary text-lg font-bold">Total Comments</h3>
          </div>
          <p className="text-5xl font-extrabold text-primary">
            {stats.overall.totalComments ?? '-'}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

export function TodayStatsCards({ className = '', ...props }: StatsCardsProps) {
  const { dashboardData } = useAdminDashboard();
  const stats = dashboardData?.stats || {
    today: { drawingsToday: 0, reactionsToday: 0, commentsToday: 0 },
  };
  return (
    <div className={className} {...props}>
      <div className="grid grid-cols-3 gap-4 mt-4">
        <Card>
          <CardContent className="text-center gap-2">
            <div className="flex gap-3 w-full justify-center items-center">
              <div className="gap-3 w-12 h-12 bg-green-500 text-shadow-white rounded-full flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faChartLine}
                  className="text-white text-lg"
                />
              </div>
              <h3 className="text-primary text-lg font-bold">Drawings Today</h3>
            </div>
            <p className="text-5xl font-extrabold text-primary">
              {stats.today.drawingsToday ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center gap-2">
            <div className="flex gap-3 w-full justify-center items-center">
              <div className="gap-3 w-12 h-12 bg-red-400 text-shadow-white rounded-full flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faHeart}
                  className="text-white text-lg"
                />
              </div>
              <h3 className="text-primary text-lg font-bold">
                Reactions Today
              </h3>
            </div>
            <p className="text-5xl font-extrabold text-primary">
              {stats.today.reactionsToday ?? '-'}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="text-center gap-2">
            <div className="flex gap-3 w-full justify-center items-center">
              <div className="gap-3 w-12 h-12 bg-yellow-400 text-shadow-white rounded-full flex items-center justify-center">
                <FontAwesomeIcon
                  icon={faComment}
                  className="text-white text-lg"
                />
              </div>
              <h3 className="text-primary text-lg font-bold">Comments Today</h3>
            </div>
            <p className="text-5xl font-extrabold text-primary">
              {stats.today.commentsToday ?? '-'}
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export function StatsCards({ className = '', ...props }: StatsCardsProps) {
  return (
    <div className={className} {...props}>
      <TotalStatsCards />
      <TodayStatsCards />
    </div>
  );
}
