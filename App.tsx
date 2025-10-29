
import React, { useState, useEffect } from 'react';
import Sidebar from './components/Sidebar';
import Header from './components/Header';
import Tools from './pages/Tools';
import UsageDashboard from './pages/UsageDashboard';
import AdminPanel from './pages/AdminPanel';
import { useAppContext } from './hooks/useAppContext';
import ToastContainer from './components/ToastContainer';

export type View = 'tools' | 'dashboard' | 'admin';

export default function App() {
  const { theme, currentUser } = useAppContext();
  const [activeView, setActiveView] = useState<View>('tools');

  useEffect(() => {
    if (theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [theme]);
  
  // If admin view is selected but user is not admin, default to tools view
  useEffect(() => {
    if(activeView === 'admin' && currentUser?.role !== 'Admin') {
      setActiveView('tools');
    }
  }, [currentUser, activeView]);

  const renderView = () => {
    switch (activeView) {
      case 'tools':
        return <Tools />;
      case 'dashboard':
        return <UsageDashboard />;
      case 'admin':
        return currentUser?.role === 'Admin' ? <AdminPanel /> : <Tools />;
      default:
        return <Tools />;
    }
  };

  return (
    <div className="flex h-screen bg-gray-100 dark:bg-gray-900 text-gray-800 dark:text-gray-200">
      <Sidebar activeView={activeView} setActiveView={setActiveView} />
      <div className="flex-1 flex flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-x-hidden overflow-y-auto p-4 md:p-6 lg:p-8">
          {renderView()}
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
