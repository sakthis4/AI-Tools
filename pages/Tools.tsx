
import React, { useState } from 'react';
import MetadataExtractor from './MetadataExtractor';
import { SparklesIcon } from '../components/icons/Icons';

export default function Tools() {
  const [isExtractorLaunched, setExtractorLaunched] = useState(false);

  if (isExtractorLaunched) {
    return <MetadataExtractor onBack={() => setExtractorLaunched(false)} />;
  }

  return (
    <div className="animate-fade-in">
      <h2 className="text-2xl font-bold mb-6 text-gray-800 dark:text-white">Tools</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition-shadow duration-300">
          <div>
            <div className="flex items-center mb-4">
              <div className="p-2 bg-primary-100 dark:bg-primary-900 rounded-full mr-3">
                <SparklesIcon className="h-6 w-6 text-primary-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Extract Metadata</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Analyzes documents (PDF, DOCX) to find figures, tables, images, and more, generating alt text, keywords, and taxonomy.
            </p>
          </div>
          <button
            onClick={() => setExtractorLaunched(true)}
            className="w-full bg-primary-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-300"
          >
            Launch Tool
          </button>
        </div>
        {/* Future tools can be added here as other cards */}
      </div>
    </div>
  );
}
