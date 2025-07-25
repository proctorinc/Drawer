import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { useAdminDashboard } from './context/AdminDashboardContext';
import { useImpersonateUser } from '@/api/Api';
import { useState } from 'react';
import { PromptModal } from './components/PromptModal';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import { WelcomeCard } from './components/WelcomeCard';
import { ActionStatsChart } from './components/ActionStatsChart';
import { UserManagementCard } from './components/UserManagementCard';
import { FuturePromptsCard } from './components/FuturePromptsCard';
import { TotalStatsCards, TodayStatsCards } from './components/StatsCards';
import { RecentUsersCard } from './components/RecentUsersCard';

const AdminPage = () => {
  const { isLoading, error } = useAdminDashboard();
  const impersonateMutation = useImpersonateUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [selectedColors, setSelectedColors] = useState<string[]>([]);

  const openModal = (day: string, prompt?: string, colors?: string[]) => {
    setSelectedDay(day);
    setSelectedPrompt(prompt || '');
    setSelectedColors(colors || []);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDay('');
    setSelectedPrompt('');
    setSelectedColors([]);
  };

  if (isLoading) {
    return <LoadingScreen />;
  }

  if (error) {
    return (
      <Layout back>
        <div className="flex flex-col items-center justify-center gap-4 text-center">
          <div className="text-6xl text-red-500">⚠️</div>
          <h2 className="text-xl font-bold text-primary">Access Denied</h2>
          <p className="text-secondary">
            You don't have permission to access this page.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <div className="flex w-full justify-center bg-base">
      <div className="grid grid-cols-1 lg:grid-cols-3 lg:max-w-7xl gap-6 w-full p-6">
        <WelcomeCard className="col-span-1 lg:col-span-3" />
        <ActionStatsChart className="col-span-1 lg:col-span-3" />
        <TotalStatsCards />
        <FuturePromptsCard
          openModal={openModal}
          className="col-span-1 lg:col-span-2"
        />
        <TodayStatsCards className="col-span-1 lg:col-span-3" />
        <RecentUsersCard />
        {/* <RecentActivityCard className="" /> */}
        <UserManagementCard
          impersonateMutation={impersonateMutation}
          loading={impersonateMutation.isPending}
          navigate={navigate}
          queryClient={queryClient}
        />
        <PromptModal
          isOpen={isModalOpen}
          onClose={closeModal}
          day={selectedDay}
          existingPrompt={selectedPrompt}
          existingColors={selectedColors}
        />
      </div>
    </div>
  );
};

export default AdminPage;
