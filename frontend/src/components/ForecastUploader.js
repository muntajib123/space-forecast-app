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
import { API_URL } from '../config'; // ✅ use centralized API_URL

const ForecastUploader = ({ onUploadSuccess = () => {} }) => {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();

    reader.onload = async (event) => {
      try {
        setUploading(true);

        // parse JSON file
        const raw = JSON.parse(event.target.result);
        const dataArray = Array.isArray(raw) ? raw : [raw];

        // POST each entry to the correct API endpoint
        await Promise.all(
          dataArray.map((entry) =>
            axios.post(API_URL, entry, {
              headers: { 'Content-Type': 'application/json' },
            })
          )
        );

        alert('✅ Forecast uploaded successfully!');
        onUploadSuccess();
      } catch (error) {
        console.error('⚠️ Upload failed', error);
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
