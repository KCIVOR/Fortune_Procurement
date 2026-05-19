'use client';

import * as React from 'react';
import { Upload, X, FileText, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

export interface FileUploadProps {
  onFileSelect: (file: File) => void;
  onFileRemove?: () => void;
  selectedFileName?: string;
  error?: string;
  disabled?: boolean;
  isLoading?: boolean;
  accept?: string;
  className?: string;
}

export function FileUpload({
  onFileSelect,
  onFileRemove,
  selectedFileName,
  error,
  disabled = false,
  isLoading = false,
  accept,
  className,
}: FileUploadProps) {
  const [isDragActive, setIsDragActive] = React.useState(false);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleDrag = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);

    if (disabled || isLoading) return;

    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      onFileSelect(e.dataTransfer.files[0]);
    }
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (disabled || isLoading) return;
    if (e.target.files && e.target.files[0]) {
      onFileSelect(e.target.files[0]);
    }
  };

  const triggerFileInput = () => {
    if (disabled || isLoading) return;
    fileInputRef.current?.click();
  };

  return (
    <div className={cn('space-y-2', className)}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        onChange={handleFileInputChange}
        disabled={disabled || isLoading}
        className="hidden"
      />

      {!selectedFileName ? (
        <div
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          onClick={triggerFileInput}
          className={cn(
            'border-2 border-dashed rounded-xl p-6 flex flex-col items-center justify-center gap-2 cursor-pointer transition select-none',
            isDragActive
              ? 'border-pq-primary-500 bg-pq-primary-50'
              : 'border-pq-neutral-300 hover:border-pq-neutral-400 bg-pq-white',
            (disabled || isLoading) && 'opacity-50 cursor-not-allowed bg-pq-neutral-50 hover:border-pq-neutral-300'
          )}
        >
          <Upload className="w-8 h-8 text-pq-neutral-400" />
          <div className="text-sm font-semibold text-pq-neutral-700 text-center">
            {isDragActive ? 'Drop your file here' : 'Drag & drop your file, or browse'}
          </div>
          <div className="text-xs text-pq-neutral-400 text-center">
            Support for PDF, Images, DOCX up to 10MB
          </div>
        </div>
      ) : (
        <div className="flex items-center justify-between p-3.5 border border-pq-neutral-200 rounded-xl bg-pq-neutral-50">
          <div className="flex items-center gap-3 min-w-0">
            <FileText className="w-5 h-5 text-pq-primary-500 shrink-0" />
            <div className="min-w-0">
              <p className="text-sm font-medium text-pq-neutral-800 truncate">
                {selectedFileName}
              </p>
              <p className="text-[10px] text-pq-neutral-400">File attached successfully</p>
            </div>
          </div>
          {onFileRemove && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={disabled || isLoading}
              onClick={(e) => {
                e.stopPropagation();
                onFileRemove();
              }}
              className="h-8 w-8 text-pq-neutral-400 hover:text-pq-danger-600 rounded-lg"
            >
              <X className="w-4 h-4" />
            </Button>
          )}
        </div>
      )}

      {error && (
        <div className="flex items-center gap-1.5 text-xs text-pq-danger-600 font-medium">
          <AlertCircle className="w-3.5 h-3.5 shrink-0" />
          <span>{error}</span>
        </div>
      )}
    </div>
  );
}
