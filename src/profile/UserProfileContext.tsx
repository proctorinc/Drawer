import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router'; // Import useNavigate from TanStack Router
import { createUser, loginUser, fetchUserProfile, type GetMeResponse } from "@/api/Api"// Adjust the path as needed

type UserProfileContextType = {
    userProfile: GetMeResponse | null;
    createUserProfile: (name: string, email: string) => Promise<void>;
    loginUserProfile: (email: string) => Promise<void>;
    reloadUser: () => Promise<void>;
}

const UserProfileContext = createContext<UserProfileContextType | undefined>(undefined);

type LoginSearchParams = {
    from?: string;
};

export const UserProfileProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [userProfile, setUserProfile] = useState<GetMeResponse | null>(null);
    const navigate = useNavigate();
    const location = useLocation();

    const loadUserProfile = async () => {
        const pathname = location.pathname;
        const { from } = location.search as LoginSearchParams;
        console.log("Coming from: ", pathname)
        console.log("Going to: ", from)

        return fetchUserProfile()
            .then((profile) => {
                console.log("Successful login!!")
                setUserProfile(profile);
                if (!pathname.startsWith('/login') && !pathname.startsWith('/create-profile')) {
                    if (from) {
                        console.log("Navigating to: ", from)
                    } else {
                        console.log("Navigating to: ", '/')
                    }
                    navigate({ to: from || '/' });
                }
            })
            .catch((error) => {
                if (!pathname.startsWith('/login') && !pathname.startsWith('/create-profile')) {
                    navigate({ to: '/create-profile', search: {
                        from: pathname
                    } });
                }
                throw error;
            });
    };

    const createUserProfile = async (name: string, email: string) => {
        return await createUser(name, email)
        .then((profile) => {
            setUserProfile(profile);
            navigate({ to: '/' });
        }).catch(() => {
            throw new Error("Email and Username must be unique");
        });
    }
    
    const loginUserProfile = async (email: string) => {
        return loginUser(email).then((profile) => {
            setUserProfile(profile);
            navigate({ to: '/' });
        }).catch(() => {
            throw new Error("Invalid login");
        });
    }

    useEffect(() => {
        loadUserProfile();
    }, []);

    const data = {
        userProfile,
        createUserProfile,
        loginUserProfile,
        reloadUser: loadUserProfile
    }

    return (
        <UserProfileContext.Provider value={data}>
            {children}
        </UserProfileContext.Provider>
    );
};

export const useProfile = (): UserProfileContextType => {
    const context = useContext(UserProfileContext);
    if (!context) {
        throw new Error('useProfile must be used within a UserProfileProvider');
    }
    return context;
};
