
import React from 'react';

interface SpinnerProps {
    size?: 'sm' | 'md' | 'lg';
    text?: string;
}

export default function Spinner({ size = 'md', text }: SpinnerProps) {
    const sizeClasses = {
        sm: 'h-6 w-6',
        md: 'h-12 w-12',
        lg: 'h-24 w-24',
    };

    return (
        <div className="flex flex-col justify-center items-center space-y-2">
            <div
                className={`animate-spin rounded-full border-4 border-gray-300 dark:border-gray-600 border-t-primary-500 ${sizeClasses[size]}`}
            ></div>
            {text && <p className="text-gray-600 dark:text-gray-300">{text}</p>}
        </div>
    );
};
