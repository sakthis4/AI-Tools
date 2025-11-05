import React, { useState } from 'react';
import MetadataExtractor from './MetadataExtractor';
import ImageMetadataExtractor from './ImageMetadataExtractor';
import ComplianceChecker from './ComplianceChecker';
import { SparklesIcon, PhotographIcon, ComplianceIcon } from '../components/icons/Icons';

export default function Tools() {
  const [activeTool, setActiveTool] = useState<'pdf' | 'image' | 'compliance' | null>(null);

  if (activeTool === 'pdf') {
    // The main container has padding. This div uses negative margins to expand
    // into that padding space, creating a "full screen" effect within the main content area.
    // The height needs to be adjusted to account for the vertical padding that is being overcome.
    // p-4 = 1rem, p-6 = 1.5rem, p-8 = 2rem.
    // Padding is on top and bottom, so we add 2rem, 3rem, and 4rem respectively.
    return (
      <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)]">
        <MetadataExtractor onBack={() => setActiveTool(null)} />
      </div>
    );
  }

  if (activeTool === 'image') {
    return (
      <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)]">
        <ImageMetadataExtractor onBack={() => setActiveTool(null)} />
      </div>
    );
  }

  if (activeTool === 'compliance') {
    return (
      <div className="-m-4 md:-m-6 lg:-m-8 h-[calc(100%+2rem)] md:h-[calc(100%+3rem)] lg:h-[calc(100%+4rem)]">
        <ComplianceChecker onBack={() => setActiveTool(null)} />
      </div>
    );
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
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Extract from PDF</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Analyzes PDF documents to find figures, tables, images, and more, generating alt text, keywords, and taxonomy.
            </p>
          </div>
          <button
            onClick={() => setActiveTool('pdf')}
            className="w-full bg-primary-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-primary-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-colors duration-300"
          >
            Launch Tool
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition-shadow duration-300">
          <div>
            <div className="flex items-center mb-4">
              <div className="p-2 bg-indigo-100 dark:bg-indigo-900 rounded-full mr-3">
                <PhotographIcon className="h-6 w-6 text-indigo-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Extract from Images</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Upload one or more images (JPG, PNG) to generate alt text, keywords, and taxonomy for each.
            </p>
          </div>
          <button
            onClick={() => setActiveTool('image')}
            className="w-full bg-indigo-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-indigo-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 transition-colors duration-300"
          >
            Launch Tool
          </button>
        </div>
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-md p-6 flex flex-col justify-between hover:shadow-xl transition-shadow duration-300">
          <div>
            <div className="flex items-center mb-4">
              <div className="p-2 bg-purple-100 dark:bg-purple-900 rounded-full mr-3">
                <ComplianceIcon className="h-6 w-6 text-purple-500" />
              </div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">Compliance Checker</h3>
            </div>
            <p className="text-sm text-gray-600 dark:text-gray-300 mb-6">
              Run pre-submission checks for plagiarism, image integrity, reference formatting, and journal guideline compliance.
            </p>
          </div>
          <button
            onClick={() => setActiveTool('compliance')}
            className="w-full bg-purple-500 text-white font-semibold py-2 px-4 rounded-lg hover:bg-purple-600 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-500 transition-colors duration-300"
          >
            Launch Tool
          </button>
        </div>
      </div>
    </div>
  );
}
