// src/components/ForecastTable.js

import React, { useEffect, useState } from 'react';
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
  Typography
} from '@mui/material';

const ForecastTable = () => {
  const [data, setData] = useState([]);

  useEffect(() => {
    fetch('http://localhost:8000/api/forecast/forecast-3day/table/')
      .then(res => res.json())
      .then(json => setData(json))
      .catch(err => console.error('Error fetching forecast data:', err));
  }, []);

  if (!data.length) return null;

  return (
    <Box
      sx={{
        backgroundImage: 'url("/images/space-bg.jpg")',
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        py: 6,
        px: 2,
        display: 'flex',
        justifyContent: 'center',
      }}
    >
      <TableContainer
        component={Paper}
        sx={{
          width: '90%',
          maxWidth: 900,
          borderRadius: 3,
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.15)',
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}
      >
        <Typography
          variant="h5"
          align="center"
          sx={{ py: 2, color: '#fff', fontWeight: 'bold' }}
        >
          3-Day Space Weather Forecast
        </Typography>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgba(0,0,0,0.4)' }}>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Date</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Kp Index</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Activity</TableCell>
              <TableCell sx={{ color: '#fff', fontWeight: 'bold' }}>Severity</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {data.map((row, idx) => (
              <TableRow
                key={idx}
                sx={{
                  '&:hover': {
                    backgroundColor: 'rgba(255,255,255,0.1)',
                    transition: '0.3s ease-in-out',
                  },
                }}
              >
                <TableCell sx={{ color: '#fff' }}>{row.date}</TableCell>
                <TableCell sx={{ color: '#fff' }}>{row.kp_index}</TableCell>
                <TableCell sx={{ color: '#fff' }}>{row.activity}</TableCell>
                <TableCell
                  sx={{
                    color:
                      row.kp_index >= 6
                        ? 'red'
                        : row.kp_index >= 4
                        ? 'orange'
                        : 'lightgreen',
                    fontWeight: 'bold',
                  }}
                >
                  {row.kp_index >= 6
                    ? 'Severe'
                    : row.kp_index >= 4
                    ? 'Moderate'
                    : 'Calm'}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ForecastTable;
