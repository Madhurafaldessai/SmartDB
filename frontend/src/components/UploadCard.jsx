import React, { useState, useRef } from 'react';
import { UploadCloud, FileSpreadsheet, AlertCircle } from 'lucide-react';

const UploadCard = ({ onFileSelected, isUploading, uploadProgress, error }) => {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef(null);

  const handleDragOver = (e) => {
    e.preventDefault();
    setIsDragOver(true);
  };

  const handleDragLeave = (e) => {
    e.preventDefault();
    setIsDragOver(false);
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      onFileSelected(e.dataTransfer.files[0]);
    }
  };

  const handleInputChange = (e) => {
    if (e.target.files && e.target.files.length > 0) {
      onFileSelected(e.target.files[0]);
    }
  };

  return (
    <div className="w-full">
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-10 md:p-12 text-center cursor-pointer transition-colors ${
          isDragOver
            ? 'border-blue-500 bg-blue-50/40'
            : 'border-slate-300 hover:border-slate-400 bg-white shadow-xs'
        }`}
      >
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleInputChange}
          accept=".csv,.xlsx,.xls"
          className="hidden"
        />

        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-14 h-14 rounded-xl bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-700">
            <UploadCloud className="w-7 h-7 text-slate-600" />
          </div>

          <div>
            <h3 className="text-base font-semibold text-slate-900 tracking-tight">
              Select or drop your spreadsheet file
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Supports CSV (<span className="font-mono font-medium text-slate-700">.csv</span>) and Excel (<span className="font-mono font-medium text-slate-700">.xlsx, .xls</span>) files up to 25MB
            </p>
          </div>

          <button
            type="button"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-sm font-medium shadow-xs transition-colors"
          >
            Browse Local File
          </button>
        </div>

        {isUploading && (
          <div className="mt-6 max-w-md mx-auto">
            <div className="flex justify-between text-xs text-slate-600 mb-1.5 font-mono font-medium">
              <span>Streaming & parsing rows...</span>
              <span>{uploadProgress}%</span>
            </div>
            <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden border border-slate-200">
              <div
                className="bg-blue-600 h-2 rounded-full transition-all duration-200"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-5 inline-flex items-center space-x-2 text-rose-700 bg-rose-50 border border-rose-200 px-4 py-2 rounded-lg text-sm font-medium">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}
      </div>
    </div>
  );
};

export default UploadCard;
