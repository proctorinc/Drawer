import useAuth from './useAuth';

const useUser = () => {
  const { user } = useAuth();

  if (!user) {
    throw new Error('useUser must be used in a logged in context');
  }

  return user;
};

export default useUser;
