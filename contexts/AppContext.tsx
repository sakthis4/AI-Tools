import React, { createContext, useState, ReactNode, useCallback, useMemo } from 'react';
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

export const AppProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [users, setUsers] = useState<User[]>(USERS);
  const [currentUser, setCurrentUser] = useState<User | null>(users.find(u => u.role === Role.Admin) || null);
  const [usageLogs, setUsageLogs] = useState<UsageLog[]>(USAGE_LOGS);
  const [toasts, setToasts] = useState<ToastData[]>([]);

  const toggleTheme = useCallback(() => {
    setTheme(prevTheme => (prevTheme === 'light' ? 'dark' : 'light'));
  }, []);

  const addToast = useCallback((toast: Omit<ToastData, 'id'>) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts(prev => [{ id, ...toast }, ...prev]);
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(toast => toast.id !== id));
  }, []);
  
  const addUser = useCallback((email: string, role: Role, tokenCap: number) => {
    setUsers(prevUsers => {
        const newUser: User = {
            id: Math.max(0, ...prevUsers.map(u => u.id)) + 1,
            email,
            role,
            tokenCap,
            tokensUsed: 0,
            lastLogin: new Date().toISOString(),
            status: 'active'
        };
        addToast({type: 'success', message: `User ${email} added successfully.`});
        return [...prevUsers, newUser];
    });
  }, [addToast]);

  const deleteUser = useCallback((userId: number) => {
    if (userId === currentUser?.id) {
        addToast({type: 'error', message: "Cannot delete the currently logged-in user."});
        return;
    }
    setUsers(prev => prev.filter(u => u.id !== userId));
    addToast({type: 'info', message: `User with ID ${userId} deleted.`});
  }, [currentUser, addToast]);

  const updateUser = useCallback((updatedUser: User) => {
    setUsers(prev => prev.map(u => u.id === updatedUser.id ? updatedUser : u));
    setCurrentUser(current => (current?.id === updatedUser.id ? updatedUser : current));
    addToast({type: 'success', message: `User ${updatedUser.email} updated.`});
  }, [addToast]);
  
  const addUsageLog = useCallback((log: Omit<UsageLog, 'id' | 'timestamp'>): { promptTokens: number, responseTokens: number } => {
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

    const updateUserWithTokens = (user: User) => ({
      ...user,
      tokensUsed: user.tokensUsed + totalTokens,
    });
    
    setUsers(prevUsers => prevUsers.map(u => (u.id === log.userId ? updateUserWithTokens(u) : u)));
    
    setCurrentUser(prevCurrentUser =>
      prevCurrentUser?.id === log.userId ? updateUserWithTokens(prevCurrentUser) : prevCurrentUser
    );

    return { promptTokens, responseTokens };
  }, []);

  const contextValue = useMemo(() => ({
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
  }), [
    theme, users, currentUser, usageLogs, toasts,
    toggleTheme, addUser, deleteUser, updateUser, addUsageLog, addToast, removeToast
  ]);

  return (
    <AppContext.Provider value={contextValue}>
      {children}
    </AppContext.Provider>
  );
};