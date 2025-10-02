'use client';

import React, { useState } from 'react';

type Props = {
  leagueId: string;
};

export default function PDFScheduleUpload({ leagueId }: Props) {
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [currentPDF, setCurrentPDF] = useState<string | null>(null);

  // Check for existing PDF on component mount
  React.useEffect(() => {
    checkForExistingPDF();
  }, [leagueId]);

  const checkForExistingPDF = async () => {
    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule/pdf-info`);
      if (res.ok) {
        const info = await res.json();
        setCurrentPDF(info.filename);
      }
    } catch (error) {
      // Ignore errors - just means no PDF exists
    }
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      setMessage('Please upload a PDF file');
      return;
    }

    setUploading(true);
    setMessage(null);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('leagueId', leagueId);

      const res = await fetch(`/api/leagues/${leagueId}/schedule/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await res.json();

      if (res.ok) {
        setMessage('Schedule PDF uploaded successfully!');
        setCurrentPDF(result.filename);
        // Clear the file input
        event.target.value = '';
      } else {
        setMessage(`Upload failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Upload error:', error);
      setMessage('Upload failed. Please try again.');
    } finally {
      setUploading(false);
    }
  };

  const handleRemovePDF = async () => {
    if (!confirm('Remove the current schedule PDF?')) return;

    try {
      const res = await fetch(`/api/leagues/${leagueId}/schedule/upload`, {
        method: 'DELETE',
      });

      if (res.ok) {
        setMessage('Schedule PDF removed');
        setCurrentPDF(null);
      } else {
        const result = await res.json();
        setMessage(`Remove failed: ${result.error}`);
      }
    } catch (error) {
      console.error('Remove error:', error);
      setMessage('Remove failed. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="card--soft p-4 rounded-2xl border">
        
        {currentPDF ? (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-green-50 rounded border">
              <span className="text-green-800">📄 {currentPDF}</span>
              <button
                onClick={handleRemovePDF}
                className="text-red-600 hover:underline text-sm"
              >
                Remove
              </button>
            </div>
              <p className="font-size: 12px; text-gray-600">
              Upload a new PDF to replace the current schedule.
            </p>
          </div>
        ) : null}

        <div className="space-y-3">
          <input
            type="file"
            accept=".pdf"
            onChange={handleFileUpload}
            disabled={uploading}
            className="block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-full file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          
          {uploading && (
            <div className="text-blue-600">
              Uploading...
            </div>
          )}
          
          {message && (
            <div className={`text-sm ${message.includes('success') || message.includes('removed') ? 'text-green-600' : 'text-red-600'}`}>
              {message}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
