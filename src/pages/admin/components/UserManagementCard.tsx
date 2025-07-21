import { Card, CardContent, CardHeader } from '@/components/Card';
import Button from '@/components/Button';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import {
  faSearch,
  faCrown,
  faUserSecret,
} from '@fortawesome/free-solid-svg-icons';
import { useState } from 'react';
import { useAdminDashboard } from '../context/AdminDashboardContext';
import type { HTMLAttributes } from 'react';

interface UserManagementCardProps extends HTMLAttributes<HTMLDivElement> {
  impersonateMutation: any;
  loading: boolean;
  navigate: any;
  queryClient: any;
  className?: string;
}

export function UserManagementCard({
  impersonateMutation,
  loading,
  navigate,
  queryClient,
  className = '',
  ...props
}: UserManagementCardProps) {
  const { dashboardData } = useAdminDashboard();
  const users = dashboardData?.users || [];
  const [searchInput, setSearchInput] = useState('');

  const filteredUsers = users.filter(
    (user) =>
      user.username.includes(searchInput) ||
      user.email.includes(searchInput) ||
      user.id.includes(searchInput),
  );

  return (
    <Card className={className} {...props}>
      <CardContent>
        <CardHeader
          title="User Management"
          subtitle="Search and manage users"
        />
        <div className="flex gap-2 mb-4">
          <div className="flex-1 relative">
            <input
              type="text"
              placeholder="Search users by username..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="w-full px-4 py-2 pl-10 bg-primary/10 border-2 border-border rounded-xl focus:outline-none focus:border-primary"
            />
            <FontAwesomeIcon
              icon={faSearch}
              className="absolute left-3 top-1/2 transform -translate-y-1/2 text-secondary"
            />
          </div>
        </div>
        <div className="space-y-2 max-h-96 overflow-y-auto">
          {filteredUsers.map((user: any) => (
            <div
              key={user.id}
              className="flex items-center justify-between p-3 bg-primary/5 rounded-lg border border-border"
            >
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h4 className="font-semibold text-primary">
                    {user.username}
                  </h4>
                  {user.role === 'admin' && (
                    <FontAwesomeIcon
                      icon={faCrown}
                      className="text-yellow-500 text-sm"
                    />
                  )}
                </div>
                <p className="text-sm text-secondary">{user.email}</p>
                <p className="text-xs text-secondary/70">
                  Created: {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
              <Button
                variant="base"
                size="sm"
                icon={faUserSecret}
                onClick={() => {
                  impersonateMutation.mutate(user.id, {
                    onSuccess: () => {
                      queryClient.invalidateQueries();
                      navigate({ to: '/draw' });
                    },
                  });
                }}
                disabled={loading}
                className="ml-2"
              >
                Impersonate
              </Button>
            </div>
          ))}
          {filteredUsers.length === 0 && (
            <div className="text-center py-8 text-secondary">
              {searchInput
                ? 'No users found matching your search.'
                : 'No users found.'}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
