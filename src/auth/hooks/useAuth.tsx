import { useContext } from 'react';
import { AuthProviderContext } from '../AuthContext';

const useAuth = () => {
  const context = useContext(AuthProviderContext);
  if (!context) {
    throw new Error('useAuth must be used within a AuthProvider');
  }
  return context;
};

export default useAuth;
