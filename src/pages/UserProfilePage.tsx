import SubmissionList from '@/profile/components/SubmissionList';
import { useProfile } from '@/profile/UserProfileContext';
import { LoadingPage } from './LoadingPage';
import { faDoorOpen, faHome } from '@fortawesome/free-solid-svg-icons';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { useNavigate } from '@tanstack/react-router';
import { FriendList } from '@/profile/components/FriendList';
import { FriendLinkShare } from '@/profile/components/FriendLinkShare';

const UserProfilePage: React.FC = () => {
    const { userProfile, logoutUser } = useProfile();
    const navigate = useNavigate();

    if (!userProfile) {
        return <LoadingPage />;
    }

    return (
        <div className="flex flex-col items-center p-2 gap-4 bg-gray-100 min-h-screen">
            <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md p-4 w-full max-w-md font-bold">
                <div className="flex flex-col">
                    <h1 className="text-2xl text-gray-900 dark:text-gray-100">{userProfile.user.name}</h1>
                    <p className="text-sm text-gray-700 dark:text-gray-500">My Profile</p>
                </div>
                <div onClick={() => navigate({ to: '/' })} className="w-12 h-12 cursor-pointer hover:scale-110 transition-all duration-300 rounded-xl bg-gray-700 text-gray-300 hover:bg-gray-500 hover:text-gray-900 font-semibold flex items-center justify-center">
                    <FontAwesomeIcon icon={faHome} />
                </div>
            </div>
            <FriendLinkShare />
            <FriendList />
            <SubmissionList />

            {/* <div className="flex justify-between items-center bg-white border border-gray-200 rounded-2xl w-full max-w-md p-4">
                <div className="border-gray-200">
                    <h3 className="text-lg font-bold">Account</h3>
                </div>
                <button onClick={() => logoutUser()} className="flex items-center gap-2 bg-gray-100 text-gray-700 cursor-pointer hover:bg-gray-200 hover:text-gray-900 hover:scale-110 transition-all duration-300 border border-gray-200 justify-center px-3 py-2 rounded-xl border-gray-200">
                    <FontAwesomeIcon icon={faDoorOpen} /> Logout
                </button>
            </div> */}
        </div>
    );
};

export default UserProfilePage;