import React from 'react';
import { Box, Typography, Table, TableHead, TableBody, TableRow, TableCell, Paper } from '@mui/material';

const ForecastBreakdown3Hourly = ({ kpIndex, apIndex }) => {
  if (!kpIndex || kpIndex.length !== 24 || !apIndex || apIndex.length !== 24) return null;

  const headers = ['00-03UT', '03-06UT', '06-09UT', '09-12UT', '12-15UT', '15-18UT', '18-21UT', '21-00UT'];
  const days = ['Day 1', 'Day 2', 'Day 3'];

  // Convert Kp + Ap into 3×8 matrices
  const matrixKp = [[], [], []];
  const matrixAp = [[], [], []];

  kpIndex.forEach((val, i) => {
    const day = Math.floor(i / 8);
    matrixKp[day].push(val.toFixed(2));
  });

  apIndex.forEach((val, i) => {
    const day = Math.floor(i / 8);
    matrixAp[day].push(val.toFixed(2));
  });

  return (
    <Box sx={{ mt: 4, display: 'flex', justifyContent: 'center' }}>
      <Paper
        sx={{
          width: '90%',
          maxWidth: 900,
          p: 3,
          backgroundColor: 'rgba(255,255,255,0.95)',
          color: '#000',
          boxShadow: '0px 4px 12px rgba(0,0,0,0.1)',
        }}
      >
        {/* ---------- Kp Index ---------- */}
        <Typography variant="h5" align="center" sx={{ mb: 2, fontWeight: 'bold', color: '#000' }}>
          3-Hourly Kp Index Forecast
        </Typography>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem', color: '#000' }}>UT</TableCell>
              {days.map((day, i) => (
                <TableCell
                  key={i}
                  sx={{ fontWeight: 'bold', fontSize: '1rem', textAlign: 'center', color: '#000' }}
                >
                  {day}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {headers.map((time, i) => (
              <TableRow key={i} sx={{ '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' } }}>
                <TableCell sx={{ fontSize: '1rem', fontWeight: '500', color: '#000' }}>{time}</TableCell>
                {matrixKp.map((dayArr, j) => (
                  <TableCell key={j} sx={{ fontSize: '1rem', textAlign: 'center', color: '#000' }}>
                    {dayArr[i]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {/* ---------- Ap Index ---------- */}
        <Typography variant="h5" align="center" sx={{ mt: 4, mb: 2, fontWeight: 'bold', color: '#000' }}>
          3-Hourly Ap Index Forecast
        </Typography>
        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '1rem', color: '#000' }}>UT</TableCell>
              {days.map((day, i) => (
                <TableCell
                  key={i}
                  sx={{ fontWeight: 'bold', fontSize: '1rem', textAlign: 'center', color: '#000' }}
                >
                  {day}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {headers.map((time, i) => (
              <TableRow key={i} sx={{ '&:hover': { backgroundColor: 'rgba(0,0,0,0.05)' } }}>
                <TableCell sx={{ fontSize: '1rem', fontWeight: '500', color: '#000' }}>{time}</TableCell>
                {matrixAp.map((dayArr, j) => (
                  <TableCell key={j} sx={{ fontSize: '1rem', textAlign: 'center', color: '#000' }}>
                    {dayArr[i]}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </Paper>
    </Box>
  );
};

export default ForecastBreakdown3Hourly;
