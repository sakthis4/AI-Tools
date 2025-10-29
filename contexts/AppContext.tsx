import React, { createContext, useState, ReactNode, useCallback } from 'react';
import { User, Role, UsageLog, ToastData } from '../types';
import { USERS, USAGE_LOGS } from '../constants';

interface AppContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
  users: User[];
  currentUser: User | null;
  setCurrentUser: (user: User) => void;
  addUser: (email: string, role: Role, tokenCap: number) => void;
  deleteUser: (userId: number) => void;
  updateUser: (user: User) => void;
  usageLogs: UsageLog[];
  addUsageLog: (log: Omit<UsageLog, 'id' | 'timestamp'>) => { promptTokens: number, responseTokens: number };
  toasts: ToastData[];
  addToast: (toast: Omit<ToastData, 'id'>) => void;
  removeToast: (id: string) => void;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

// FIX: Changed component to be a React.FC to potentially resolve typing issues with children prop.
export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [users, setUsers] = useState<User[]>(USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(users.find(u => u.role === Role.Admin) || null);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>(USAGE_LOGS);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toggleTheme = () => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  };

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [...prev, { id, ...toast }]);
  }, []);

  const removeToast = (id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  };
  
  const addUser = (email: string, role: Role, tokenCap: number) => {
    const newUser: User = {
        id: Math.max(...users.map(u => u.id)) + 1,
        email,
        role,
        tokenCap,
        tokensUsed: 0,
        lastLogin: new Date().toISOString(),
        status: 'active'
    };
    setUsers(prev => [...prev, newUser]);
    addToast({type: 'success', message: `User ${email} added successfully.`});
  };

  const deleteUser = (userId: number) => {
    if (userId === currentUser?.id) {
        addToast({type: 'error', message: "Cannot delete the currently logged-in user."});
        return;
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
    addToast({type: 'info', message: `User with ID ${userId} deleted.`});
  };

  const updateUser = (updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    if (updatedUser.id === currentUser?.id) {
        setCurrentUser(updatedUser);
    }
    addToast({type: 'success', message: `User ${updatedUser.email} updated.`});
  };
  
  const addUsageLog = (log: Omit<UsageLog, 'id' | 'timestamp'>): { promptTokens: number, responseTokens: number } => {
    // In a real app, tokens would come from the API response. Here we mock them.
    const promptTokens = Math.floor(Math.random() * 3000) + 500;
    const responseTokens = Math.floor(Math.random() * 2000) + 300;
    const totalTokens = promptTokens + responseTokens;

    const newLog: UsageLog = {
      ...log,
      id: `log_${Date.now()}`,
      timestamp: new Date().toISOString(),
      promptTokens,
      responseTokens
    };
    setUsageLogs(prev => [newLog, ...prev]);

    const user = users.find(u => u.id === log.userId);
    if(user) {
        const updatedUser = {...user, tokensUsed: user.tokensUsed + totalTokens};
        updateUser(updatedUser);
    }

    return { promptTokens, responseTokens };
  };

  const contextValue: AppContextType = {
    theme,
    toggleTheme,
    users,
    currentUser,
    setCurrentUser,
    addUser,
    deleteUser,
    updateUser,
    usageLogs,
    addUsageLog,
    toasts,
    addToast,
    removeToast,
  };

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};