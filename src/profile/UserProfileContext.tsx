import { createContext, useContext, useEffect, useState } from 'react';
import { useLocation, useNavigate } from '@tanstack/react-router';
import { createUser, loginUser, logoutUser, fetchUserProfile, type GetMeResponse } from "@/api/Api"

type UserProfileContextType = {
    userProfile: GetMeResponse | null;
    createUserProfile: (username: string, email: string) => Promise<{ message: string }>;
    loginUserProfile: (email: string) => Promise<{ message: string }>;
    logout: () => Promise<void>;
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
                if (pathname.startsWith('/app/login') || pathname.startsWith('/app/create-profile')) {
                    if (from) {
                        console.log("Navigating to: ", from)
                    } else {
                        console.log("Navigating to: ", '/')
                    }
                    navigate({ to: from || '/app' });
                }
            })
            .catch((error) => {
                if (!pathname.startsWith('/app/login') && !pathname.startsWith('/app/create-profile')) {
                    navigate({ to: '/app/create-profile', search: {
                        from: pathname
                    } });
                }
                throw error;
            });
    };

    const createUserProfile = async (username: string, email: string) => {
        return await createUser(username, email).catch(() => {
            throw new Error("Email and Username must be unique");
        });
    }
    
    const loginUserProfile = async (email: string) => {
        return loginUser(email).catch(() => {
            throw new Error("Invalid login");
        });
    }

    const logout = async () => {
        logoutUser()
            .then(() => {
                setUserProfile(null);
                navigate({ to: "/app/login" });
            });
    }

    useEffect(() => {
        loadUserProfile();
    }, []);

    const data: UserProfileContextType = {
        userProfile,
        createUserProfile,
        loginUserProfile,
        logout,
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
