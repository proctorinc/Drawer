import {
  createContext,
  useContext,
  useState,
  type FC,
  type ReactNode,
} from 'react';
import { useGetAdminDashboard, type DailyActionStat } from '@/api/Api';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/api/apiClient';

type AdminDashboardContextType = {
  dashboardData:
    | {
        message: string;
        admin: {
          id: string;
          username: string;
          email: string;
        };
        users: Array<{
          id: string;
          username: string;
          email: string;
          role: string;
          createdAt: string;
        }>;
        futurePrompts: Array<{
          day: string;
          colors: Array<string>;
          prompt: string;
        }>;
        stats: {
          overall: {
            totalUsers: number;
            totalDrawings: number;
            totalReactions: number;
            totalComments: number;
          };
          today: {
            drawingsToday: number;
            reactionsToday: number;
            commentsToday: number;
          };
          recentUsers: Array<{
            ID: string;
            Username: string;
            Email: string;
            CreatedAt: string;
          }>;
        };
      }
    | undefined;
  isLoading: boolean;
  error: any;
  refetch: () => Promise<any>;
  searchQuery: string;
  setSearchQuery: (query: string) => void;
  actionStats: DailyActionStat[] | undefined;
  actionStatsLoading: boolean;
  actionStatsError: any;
  fetchActionStats: (start: string, end: string) => void;
};

const AdminDashboardContext = createContext<
  AdminDashboardContextType | undefined
>(undefined);

type Props = {
  children: ReactNode;
};

export const AdminDashboardProvider: FC<Props> = ({ children }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const {
    data: dashboardData,
    isLoading,
    error,
    refetch,
  } = useGetAdminDashboard(searchQuery);

  const [actionStatsParams, setActionStatsParams] = useState<{
    start: string;
    end: string;
  } | null>(null);
  const {
    data: actionStats,
    isLoading: actionStatsLoading,
    error: actionStatsError,
  } = useQuery({
    queryKey: actionStatsParams
      ? ['adminActionStats', actionStatsParams.start, actionStatsParams.end]
      : ['adminActionStats', 'none'],
    queryFn: actionStatsParams
      ? () =>
          apiClient.getAdminActionStats(
            actionStatsParams.start,
            actionStatsParams.end,
          )
      : async () => [],
    enabled: !!actionStatsParams,
    staleTime: 1000 * 60, // 1 minute
  });
  const fetchActionStats = (start: string, end: string) => {
    setActionStatsParams({ start, end });
    // Optionally, you can call refetchActionStats() here if you want immediate fetch
  };

  const contextValue: AdminDashboardContextType = {
    dashboardData,
    isLoading,
    error,
    refetch,
    searchQuery,
    setSearchQuery,
    actionStats,
    actionStatsLoading,
    actionStatsError,
    fetchActionStats,
  };

  return (
    <AdminDashboardContext.Provider value={contextValue}>
      {children}
    </AdminDashboardContext.Provider>
  );
};

export const useAdminDashboard = () => {
  const context = useContext(AdminDashboardContext);
  if (!context) {
    throw new Error(
      'useAdminDashboard must be used within an AdminDashboardProvider',
    );
  }
  return context;
};
