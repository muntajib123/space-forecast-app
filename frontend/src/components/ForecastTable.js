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
import { API_URL } from '../config'; // make sure config.js uses "export const API_URL"

const ForecastTable = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      setLoading(true);
      try {
        console.log('🌍 ForecastTable calling API_URL =', API_URL);

        const res = await fetch(API_URL);
        console.log('📡 Fetch status =', res.status, res.statusText);

        if (!res.ok) {
          const text = await res.text().catch(() => '<no body>');
          console.error('⚠️ Non-OK response body:', text);
          throw new Error('Network response was not ok');
        }

        const json = await res.json();
        console.debug(
          '✅ Raw forecast data (first item):',
          Array.isArray(json) ? json[0] : json?.predictions?.[0]
        );

        // Ensure array format
        const raw = Array.isArray(json) ? json : json.predictions || [];

        // Only keep future days
        const todayISO = new Date().toISOString().slice(0, 10);
        const safe = raw
          .filter(d => typeof d.date === 'string' && d.date > todayISO)
          .sort((a, b) => a.date.localeCompare(b.date))
          .slice(0, 3)
          .map(item => {
            const kpArr = Array.isArray(item.kp_index)
              ? item.kp_index
              : item.kp_index || [];
            const kpMax = kpArr.length ? Math.round(Math.max(...kpArr)) : null;
            const kpDisplay = kpArr.length ? kpArr.join(', ') : 'N/A';

            let activity = 'N/A';
            if (item.solar_radiation) {
              if (Array.isArray(item.solar_radiation) && item.solar_radiation.length) {
                activity = String(item.solar_radiation[0]);
              } else if (typeof item.solar_radiation === 'object') {
                const vals = Object.values(item.solar_radiation);
                activity = vals.length ? String(vals[0]) : 'N/A';
              } else {
                activity = String(item.solar_radiation);
              }
            }

            return {
              date: item.date,
              kp_index: kpDisplay,
              kp_max: kpMax,
              activity,
            };
          });

        setData(safe);
      } catch (err) {
        console.error('❌ Error fetching forecast data:', err);
        setData([]);
      } finally {
        setLoading(false);
      }
    }

    load();
  }, []);

  // Loading state
  if (loading) {
    return (
      <Box
        sx={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6">Loading forecast…</Typography>
      </Box>
    );
  }

  // No data state
  if (!data.length) {
    return (
      <Box
        sx={{
          minHeight: '50vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Typography variant="h6">No forecast data available.</Typography>
      </Box>
    );
  }

  return (
    <Box
      sx={{
        backgroundImage: 'url("/space-bg.jpg")',
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
          width: '95%',
          maxWidth: 950,
          borderRadius: 4,
          backdropFilter: 'blur(12px)',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          boxShadow: '0px 6px 20px rgba(0,0,0,0.15)',
        }}
      >
        <Typography
          variant="h5"
          align="center"
          sx={{
            py: 3,
            background: 'linear-gradient(90deg, #1976d2, #42a5f5)',
            color: '#fff',
            fontWeight: 'bold',
            borderTopLeftRadius: '16px',
            borderTopRightRadius: '16px',
            fontSize: '1.7rem',
          }}
        >
          🚀 3-Day Space Weather Forecast
        </Typography>

        <Table>
          <TableHead>
            <TableRow sx={{ backgroundColor: 'rgba(0,0,0,0.05)' }}>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>📅 Date</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>🌌 Kp Index</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>☀️ Activity</TableCell>
              <TableCell sx={{ fontWeight: 'bold', fontSize: '1.1rem' }}>📡 Severity</TableCell>
            </TableRow>
          </TableHead>

          <TableBody>
            {data.map((row, idx) => {
              const kpMax = row.kp_max;
              const color =
                kpMax === null ? '#000' :
                kpMax >= 6 ? '#d32f2f' :
                kpMax >= 4 ? '#f57c00' :
                '#388e3c';
              const severity =
                kpMax === null ? 'Unknown' :
                kpMax >= 6 ? 'Severe' :
                kpMax >= 4 ? 'Moderate' :
                'Calm';

              return (
                <TableRow
                  key={idx}
                  sx={{
                    backgroundColor: idx % 2 === 0 ? 'rgba(0,0,0,0.02)' : 'transparent',
                    '&:hover': {
                      backgroundColor: 'rgba(25, 118, 210, 0.1)',
                      transition: '0.3s ease-in-out',
                    },
                  }}
                >
                  <TableCell sx={{ fontSize: '1rem', fontWeight: 500 }}>
                    {row.date}
                  </TableCell>
                  <TableCell sx={{ fontSize: '0.95rem', textAlign: 'center' }}>
                    {row.kp_index}
                  </TableCell>
                  <TableCell sx={{ fontSize: '1rem' }}>{row.activity}</TableCell>
                  <TableCell
                    sx={{
                      fontWeight: 'bold',
                      fontSize: '1rem',
                      color: color,
                    }}
                  >
                    {severity}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
};

export default ForecastTable;
