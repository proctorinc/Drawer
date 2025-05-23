import React, { useState } from 'react';
import { useNavigate, useParams } from '@tanstack/react-router';
import { addFriend } from '@/api/Api';

const AddFriendPage: React.FC = () => {
    const navigate = useNavigate()
    const { userId } = useParams({ from: "/app/add-friend/$userId"});
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const handleAddFriend = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccess('');

        try {
            await addFriend(userId);
            setSuccess('Friend added successfully!');
            navigate({ to: "/app/user-profile" })
        } catch (err) {
            setError('Error adding friend: ' + (err as Error).message);
        }
    };

    return (
        <div className="flex flex-col items-center p-4 gap-4 bg-gray-100 min-h-screen">
            <div className="flex flex-col justify-center items-center w-full gap-4 flex-grow">
                <div className="flex justify-between items-center bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl shadow-md px-6 py-2 w-full max-w-md font-bold">
                    <div className="flex flex-col">
                        <h1 className="text-2xl text-gray-900 dark:text-gray-100">Add a friend!</h1>
                    </div>
                </div>
                <form onSubmit={handleAddFriend} className="flex flex-col gap-4 bg-white border border-gray-300 rounded-2xl w-full max-w-md p-4">
                    {error && <p className="text-red-500">{error}</p>}
                    {success && <p className="text-green-500">{success}</p>}
                    <p>Are you sure you want to add user with ID: {userId}?</p>
                    <button
                            type="submit"
                            className="flex justify-center cursor-pointer disabled:cursor-default disabled:scale-100 hover:scale-110 transition-all duration-300 text-lg gap-2 items-center bg-gradient-to-tr from-blue-600 to-purple-600 font-bold px-6 py-3 rounded-2xl shadow-md disabled:opacity-50"
                        >
                            Add Friend
                        </button>
                </form>
            </div>
        </div>
    );
};

export default AddFriendPage;
