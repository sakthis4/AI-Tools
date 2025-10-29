
import React from 'react';
import { useAppContext } from '../hooks/useAppContext';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { InfoIcon } from '../components/icons/Icons';

export default function UsageDashboard() {
  const { currentUser, usageLogs } = useAppContext();

  const userLogs = currentUser ? usageLogs.filter(log => log.userId === currentUser.id) : [];

  const data = userLogs.map(log => ({
    name: new Date(log.timestamp).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    tokens: log.promptTokens + log.responseTokens,
    promptTokens: log.promptTokens,
    responseTokens: log.responseTokens,
  }));
  
  const tokensRemaining = currentUser ? currentUser.tokenCap - currentUser.tokensUsed : 0;
  const percentageUsed = currentUser ? (currentUser.tokensUsed / currentUser.tokenCap) * 100 : 0;

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Usage / Token Dashboard</h2>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Tokens Used</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{currentUser?.tokensUsed.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Token Cap</h3>
          <p className="text-3xl font-bold text-gray-900 dark:text-white">{currentUser?.tokenCap.toLocaleString()}</p>
        </div>
        <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400">Tokens Remaining</h3>
          <p className="text-3xl font-bold text-primary-500">{tokensRemaining.toLocaleString()}</p>
        </div>
      </div>
      
      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Consumption Overview</h3>
        <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-4">
            <div
                className={`h-4 rounded-full text-center text-white text-xs ${percentageUsed > 85 ? 'bg-red-500' : percentageUsed > 60 ? 'bg-yellow-500' : 'bg-primary-500'}`}
                style={{ width: `${percentageUsed}%` }}
            >
                {Math.round(percentageUsed)}%
            </div>
        </div>
        {percentageUsed >= 100 && (
            <div className="mt-4 p-4 bg-red-100 dark:bg-red-900 border-l-4 border-red-500 text-red-700 dark:text-red-200">
                <p className="font-bold">Token Cap Reached</p>
                <p>You have used all your available tokens. Please contact an administrator to top up your account.</p>
            </div>
        )}
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md mb-8">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Usage by Day</h3>
        <div style={{ width: '100%', height: 300 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 5, right: 20, left: -10, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(128, 128, 128, 0.2)" />
              <XAxis dataKey="name" />
              <YAxis />
              <Tooltip
                contentStyle={{
                  backgroundColor: 'rgba(31, 41, 55, 0.8)',
                  borderColor: 'rgba(75, 85, 99, 0.8)'
                }}
                itemStyle={{ color: '#E5E7EB' }}
                labelStyle={{ color: 'white', fontWeight: 'bold' }}
              />
              <Legend />
              <Bar dataKey="tokens" stackId="a" fill="#3b82f6" name="Total Tokens" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="bg-white dark:bg-gray-800 p-6 rounded-lg shadow-md">
        <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Usage Log</h3>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
            <thead className="bg-gray-50 dark:bg-gray-700">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Tool Name</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Prompt Tokens</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Response Tokens</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Total</th>
              </tr>
            </thead>
            <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
              {userLogs.map(log => (
                <tr key={log.id}>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 dark:text-gray-100">{new Date(log.timestamp).toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{log.toolName}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{log.promptTokens.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-300">{log.responseTokens.toLocaleString()}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 dark:text-gray-100">{(log.promptTokens + log.responseTokens).toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
