import { useState } from 'react';
import { useNavigate } from '@tanstack/react-router';
import { useQueryClient } from '@tanstack/react-query';
import {
  faImagePortrait,
  faRotateLeft,
  faUserSecret,
} from '@fortawesome/free-solid-svg-icons';
import { useAdminUsers } from '../api';
import PicturePicker from '../components/PicturePicker';
import {
  AdminPage,
  Loaded,
  SearchInput,
  Table,
  Tag,
  decorationName,
  formatDay,
  td,
  th,
} from '../components/ui';
import type { AdminUser } from '../api';
import type { FC } from 'react';
import { useImpersonateUser } from '@/api/Api';
import { switchAccount } from '@/animations/useProgressWatcher';
import Button from '@/components/Button';
import { UserProfileIcon } from '@/pages/profile/components/profile-icons/UserProfileIcon';
import Sheet from '@/pages/profile/components/Sheet';

const PictureSheet: FC<{ user?: AdminUser; onClose: () => void }> = ({
  user,
  onClose,
}) => (
  <Sheet
    title={user ? `${user.username}'s picture` : 'picture'}
    open={!!user}
    onClose={onClose}
  >
    {user && <PicturePicker key={user.id} user={user} onDone={onClose} />}
  </Sheet>
);

const UsersPage = () => {
  const users = useAdminUsers();
  const impersonate = useImpersonateUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  // Whose picture the drawer is swapping, by id so it follows the refreshed list
  const [picturing, setPicturing] = useState<string>();

  const becomeUser = (userId: string) =>
    impersonate.mutate(userId, {
      onSuccess: () => {
        void switchAccount(queryClient);
        navigate({ to: '/draw' });
      },
    });

  return (
    <AdminPage
      title="users"
      subtitle={users.data && `${users.data.length} players, newest first`}
      actions={
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="name, email or id"
        />
      }
    >
      <Loaded query={users}>
        {(list) => {
          const needle = search.toLowerCase();
          const shown = list.filter((u) =>
            [u.username, u.email, u.id].some((s) =>
              s.toLowerCase().includes(needle),
            ),
          );
          return (
            <Table
              head={
                <>
                  <th className={th}>player</th>
                  <th className={th}>joined</th>
                  <th className={th}>drawings</th>
                  <th className={th}>last drew</th>
                  <th className={th}>friends</th>
                  <th className={th}>achievements</th>
                  <th className={th}>wearing</th>
                  <th className={th}>flags</th>
                  <th className={th} />
                </>
              }
            >
              {shown.map((user) => (
                <tr key={user.id}>
                  <td className={td}>
                    <div className="flex items-center gap-3">
                      <UserProfileIcon
                        user={user}
                        size="sm"
                        onClick={() => setPicturing(user.id)}
                      />
                      <div className="flex flex-col leading-tight">
                        <span className="font-bold">{user.username}</span>
                        <span className="text-sm text-pencil">
                          {user.email}
                        </span>
                      </div>
                    </div>
                  </td>
                  <td className={td}>
                    {new Date(user.createdAt).toLocaleDateString()}
                  </td>
                  <td className={td}>{user.drawings}</td>
                  <td className={td}>
                    {user.lastDrawnDay ? formatDay(user.lastDrawnDay) : '–'}
                  </td>
                  <td className={td}>{user.friends}</td>
                  <td className={td}>{user.achievements}</td>
                  <td className={td}>
                    {user.decoration ? decorationName(user.decoration) : '–'}
                  </td>
                  <td className={td}>
                    <div className="flex gap-1">
                      {user.isAdmin && <Tag className="bg-butter">admin</Tag>}
                      {user.avatarType === 'custom' && <Tag>drawn pic</Tag>}
                      {user.pushSubscribed && <Tag>push</Tag>}
                    </div>
                  </td>
                  <td className={td}>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="base"
                        disableLoad
                        icon={faImagePortrait}
                        onClick={() => setPicturing(user.id)}
                      >
                        pic
                      </Button>
                      <Button
                        size="sm"
                        variant="base"
                        disableLoad
                        icon={faRotateLeft}
                        onClick={() =>
                          navigate({
                            to: '/draw/admin/redos',
                            search: { user: user.id },
                          })
                        }
                      >
                        redo
                      </Button>
                      <Button
                        size="sm"
                        variant="base"
                        icon={faUserSecret}
                        disabled={impersonate.isPending}
                        onClick={() => becomeUser(user.id)}
                      >
                        be them
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </Table>
          );
        }}
      </Loaded>
      <PictureSheet
        user={users.data?.find((u) => u.id === picturing)}
        onClose={() => setPicturing(undefined)}
      />
    </AdminPage>
  );
};

export default UsersPage;
