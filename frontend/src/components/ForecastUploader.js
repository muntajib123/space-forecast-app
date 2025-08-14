// frontend/src/components/ForecastUploader.js

import React, { useState } from 'react';
import axios from 'axios';
import {
  Card,
  CardContent,
  Typography,
  Button,
  LinearProgress,
  Box
} from '@mui/material';

const ForecastUploader = ({ onUploadSuccess = () => {} }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        setUploading(true);
        const raw = JSON.parse(event.target.result);
        const dataArray = Array.isArray(raw) ? raw : [raw];

        await Promise.all(
          dataArray.map((entry) =>
            axios.post('http://127.0.0.1:8000/api/forecast-3day/', entry)
          )
        );

        alert('✅ Forecast uploaded successfully!');
        onUploadSuccess();
      } catch (error) {
        console.error('Upload failed', error);
        alert('⚠️ Upload failed. Please check the console for details.');
      } finally {
        setUploading(false);
      }
    };

    reader.readAsText(file);
  };

  return (
    <Card sx={{ mt: 4, backgroundColor: '#1a1a1a', color: '#fff' }}>
      <CardContent>
        <Typography variant="h6" gutterBottom sx={{ color: '#60a5fa' }}>
          📤 Upload 3-Day Forecast JSON
        </Typography>

        <Box display="flex" alignItems="center" gap={2}>
          <input
            type="file"
            accept=".json"
            id="upload-forecast"
            style={{ display: 'none' }}
            onChange={handleFileChange}
            disabled={uploading}
          />
          <label htmlFor="upload-forecast">
            <Button
              variant="contained"
              component="span"
              disabled={uploading}
              sx={{
                backgroundColor: '#3b82f6',
                '&:hover': { backgroundColor: '#2563eb' }
              }}
            >
              Choose File
            </Button>
          </label>
          {uploading && (
            <Typography variant="body2" sx={{ color: '#facc15' }}>
              Uploading data...
            </Typography>
          )}
        </Box>

        {uploading && <LinearProgress sx={{ mt: 2 }} />}
      </CardContent>
    </Card>
  );
};

export default ForecastUploader;
