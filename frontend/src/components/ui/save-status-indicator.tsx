import React from 'react';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

export type SaveStatus = 'idle' | 'saving' | 'saved' | 'error';

interface SaveStatusIndicatorProps {
  status: SaveStatus;
  className?: string;
}

export function SaveStatusIndicator({ status, className = '' }: SaveStatusIndicatorProps) {
  switch (status) {
    case 'saving':
      return (
        <div className={`flex items-center gap-2 text-sm text-gray-600 ${className}`}>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Saving...</span>
        </div>
      );
    case 'saved':
      return (
        <div className={`flex items-center gap-2 text-sm text-green-600 ${className}`}>
          <CheckCircle className="h-4 w-4" />
          <span>Saved</span>
        </div>
      );
    case 'error':
      return (
        <div className={`flex items-center gap-2 text-sm text-red-600 ${className}`}>
          <AlertCircle className="h-4 w-4" />
          <span>Error saving</span>
        </div>
      );
    default:
      return null;
  }
}