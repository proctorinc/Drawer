import { useMemo, useState } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTimes } from '@fortawesome/free-solid-svg-icons';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import type { User } from '@/api/Api';

interface UserSelectorProps {
  users: Array<User>;
  onSelectUser: (user: User) => void;
  onClose: () => void;
}

export function UserSelector({
  users,
  onSelectUser,
  onClose,
}: UserSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');

  const filteredUsers = useMemo(() => {
    if (!searchTerm) {
      return users;
    }
    return users.filter((user) =>
      user.username.toLowerCase().includes(searchTerm.toLowerCase()),
    );
  }, [searchTerm, users]);

  const handleSelectUser = (user: User) => {
    onSelectUser(user);
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[10000]">
      <div className="bg-card border border-border rounded-lg p-6 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-semibold text-primary">Select a User</h2>
          <button
            onClick={onClose}
            className="text-secondary hover:text-primary transition-colors"
          >
            <FontAwesomeIcon icon={faTimes} />
          </button>
        </div>

        <input
          type="text"
          placeholder="Search by username..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="w-full p-3 mb-4 border border-border rounded-lg bg-background text-primary placeholder-secondary focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
        />

        <div className="max-h-60 overflow-y-auto">
          {filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <div
                key={user.id}
                onClick={() => handleSelectUser(user)}
                className="p-3 rounded-lg cursor-pointer hover:bg-primary/10 transition-colors flex items-center gap-2"
              >
                <UserProfileIcon size="sm" user={user} />
                <span className="font-medium text-primary">
                  {user.username}
                </span>
              </div>
            ))
          ) : (
            <p className="text-secondary text-center p-4">No users found.</p>
          )}
        </div>
      </div>
    </div>
  );
}
