import Layout from '@/components/Layout';
import LoadingScreen from '@/components/LoadingScreen';
import { useAdminDashboard } from './context/AdminDashboardContext';
import { useImpersonateUser, type User } from '@/api/Api';
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
import { Card, CardContent, CardHeader } from '@/components/Card';
import { UserProfileIcon } from '../profile/components/profile-icons/UserProfileIcon';
import DrawingCanvas from '../feed/components/DrawingCanvas';
import { generateRandomColors } from './utils';
import useLocalStorage from '@/hooks/useLocalStorage';

const AdminPage = () => {
  const { promptSuggestions, isLoading, error } = useAdminDashboard();
  const impersonateMutation = useImpersonateUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedPrompt, setSelectedPrompt] = useState<string>('');
  const [selectedColors, setSelectedColors] = useState<Array<string>>([]);
  const [selectedCreatedBy, setSelectedCreatedBy] = useState<User | undefined>(
    undefined,
  );
  const [testColors, setTestColors] = useLocalStorage<Array<string>>(
    'test-colors',
    generateRandomColors(),
    10000,
  );
  const [testBackgroundColor, setTestBackgroundColor] = useLocalStorage<string>(
    'test-background-color',
    '#00000',
    10000,
  );

  const updateColor = (index: number, color: string) => {
    setTestColors((prevColors) => {
      prevColors[index] = color;
      return prevColors;
    });
  };

  const openModal = (
    day: string,
    prompt?: string,
    colors?: Array<string>,
    createdBy?: User,
  ) => {
    setSelectedDay(day);
    setSelectedPrompt(prompt || '');
    setSelectedColors(colors || []);
    setSelectedCreatedBy(createdBy || undefined);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setSelectedDay('');
    setSelectedPrompt('');
    setSelectedColors([]);
    setSelectedCreatedBy(undefined);
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
        <Card>
          <CardContent>
            <CardHeader title="Suggested prompts" />
            {promptSuggestions?.map((suggestion) => (
              <div key={suggestion.id} className="flex items-center gap-2">
                <UserProfileIcon size="sm" user={suggestion.createdBy} />
                <h3>{suggestion.prompt}</h3>
              </div>
            ))}
          </CardContent>
        </Card>
        <TodayStatsCards className="col-span-1 lg:col-span-3" />
        <RecentUsersCard />
        {/* <RecentActivityCard className="" /> */}
        <UserManagementCard
          impersonateMutation={impersonateMutation}
          loading={impersonateMutation.isPending}
          navigate={navigate}
          queryClient={queryClient}
        />
        <Card>
          <CardContent className="flex flex-col items-center">
            <DrawingCanvas
              variant="round"
              colors={testColors}
              backgroundColor={testBackgroundColor}
              downloadEnabled
            />
            <div className="space-y-2">
              {testColors.map((color, index) => {
                return (
                  <div key={index} className="flex flex-col gap-2">
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
              <div className="flex flex-col gap-2">
                <span className="text-sm text-secondary">Background color</span>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    value={testBackgroundColor}
                    onChange={(e) => setTestBackgroundColor(e.target.value)}
                    className="w-12 h-10 border border-border rounded cursor-pointer"
                  />
                  <input
                    type="text"
                    value={testBackgroundColor}
                    onChange={(e) => setTestBackgroundColor(e.target.value)}
                    placeholder="#000000"
                    className="flex-1 p-2 border border-border rounded bg-background text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
        <PromptModal
          isOpen={isModalOpen}
          onClose={closeModal}
          day={selectedDay}
          existingPrompt={selectedPrompt}
          existingColors={selectedColors}
          existingCreatedBy={selectedCreatedBy}
        />
      </div>
    </div>
  );
};

export default AdminPage;
