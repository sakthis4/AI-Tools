
import React from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { SunIcon, MoonIcon, InfoIcon, UserCircleIcon } from './icons/Icons';
import { Role } from '../types';

export default function Header() {
  const { theme, toggleTheme, currentUser, users, setCurrentUser } = useAppContext();
  
  const tokensRemaining = currentUser ? currentUser.tokenCap - currentUser.tokensUsed : 0;
  const percentageUsed = currentUser ? (currentUser.tokensUsed / currentUser.tokenCap) * 100 : 0;

  const handleUserChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
      const selectedUser = users.find(u => u.id === parseInt(e.target.value));
      if(selectedUser) {
          setCurrentUser(selectedUser);
      }
  };

  return (
    <header className="flex-shrink-0 bg-white dark:bg-gray-800 shadow-md">
      <div className="flex items-center justify-between p-4 h-16">
        <div className="flex items-center space-x-4">
            {/* User switcher for prototype demonstration */}
            <div className="relative">
                <select 
                    onChange={handleUserChange} 
                    value={currentUser?.id}
                    className="pl-8 pr-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-full appearance-none focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                    {users.map(user => (
                        <option key={user.id} value={user.id}>{user.email}</option>
                    ))}
                </select>
                <UserCircleIcon className="absolute left-2 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500 dark:text-gray-400" />
            </div>
            {currentUser && <span className={`px-3 py-1 text-xs font-semibold rounded-full ${currentUser.role === Role.Admin ? 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-300' : 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300'}`}>{currentUser.role}</span>}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="group relative flex items-center space-x-2">
            <div className="w-48 bg-gray-200 dark:bg-gray-700 rounded-full h-2.5">
              <div
                className={`h-2.5 rounded-full ${percentageUsed > 85 ? 'bg-red-500' : percentageUsed > 60 ? 'bg-yellow-500' : 'bg-primary-500'}`}
                style={{ width: `${percentageUsed}%` }}
              ></div>
            </div>
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">{tokensRemaining.toLocaleString()} tokens left</span>
            <InfoIcon className="h-4 w-4 text-gray-500" />
            <div className="absolute bottom-full mb-2 w-72 left-1/2 -translate-x-1/2 hidden group-hover:block bg-gray-800 text-white text-xs rounded py-2 px-3 z-10 shadow-lg">
              Token usage is based on Gemini API billing: prompt + response tokens.
              <div className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0 border-x-8 border-x-transparent border-t-8 border-t-gray-800"></div>
            </div>
          </div>

          <button
            onClick={toggleTheme}
            className="p-2 rounded-full text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            {theme === 'light' ? <MoonIcon className="h-6 w-6" /> : <SunIcon className="h-6 w-6" />}
          </button>
        </div>
      </div>
    </header>
  );
}
