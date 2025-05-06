import React, { useState } from 'react';
import { useParams } from '@tanstack/react-router';
import { addFriend } from '@/api/Api';

const AddFriendPage: React.FC = () => {
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
        } catch (err) {
            setError('Error adding friend: ' + (err as Error).message);
        }
    };

    return (
        <div className="flex flex-col items-center p-4 gap-4 bg-gray-100 min-h-screen">
            <h1 className="text-2xl">Add a Friend</h1>
            <form onSubmit={handleAddFriend} className="flex flex-col gap-4">
                {error && <p className="text-red-500">{error}</p>}
                {success && <p className="text-green-500">{success}</p>}
                <p>Are you sure you want to add user with ID: {userId}?</p>
                <button type="submit" className="bg-blue-500 cursor-pointer text-white p-2 rounded">
                    Add Friend
                </button>
            </form>
        </div>
    );
};

export default AddFriendPage;
