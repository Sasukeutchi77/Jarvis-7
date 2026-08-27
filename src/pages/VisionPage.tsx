import React from 'react';
import { VisionStudio } from '../components/Vision/VisionStudio';

interface VisionPageProps {
  onInsertIntoChat?: (image: string, analysis: string) => void;
}

export const VisionPage: React.FC<VisionPageProps> = ({ onInsertIntoChat }) => {
  return (
    <div className="h-full w-full flex flex-col overflow-hidden bg-slate-900">
      <VisionStudio onInsertIntoChat={onInsertIntoChat} />
    </div>
  );
};
