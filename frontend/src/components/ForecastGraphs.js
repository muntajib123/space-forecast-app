// ForecastGraphs.js
import React from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis,
  Tooltip, Legend,
  CartesianGrid, ResponsiveContainer
} from 'recharts';

import { Card, CardContent, Typography, Box } from '@mui/material';

const ForecastGraphs = ({ data }) => {
  // Light theme
  const cardBg = '#fff';
  const textPrimary = '#000';
  const gridStroke = '#ccc';
  const axisStroke = '#444';
  const tooltipBg = '#fefefe';
  const tooltipText = '#000';

  return (
    <Box sx={{ mt: 4, px: 2 }}>
      {/* Kp Index Forecast */}
      <Card
        sx={{
          backgroundColor: cardBg,
          color: textPrimary,
          mb: 4,
          borderRadius: 4,
          boxShadow: '0px 6px 16px rgba(0,0,0,0.15)'
        }}
      >
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              background: 'linear-gradient(90deg, #1976d2, #42a5f5)',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold',
              mb: 2
            }}
          >
            🛰️ Kp Index Forecast
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" stroke={axisStroke} />
              <YAxis domain={[0, 10]} stroke={axisStroke} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: '1px solid #ccc',
                  color: tooltipText,
                  borderRadius: 6
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="kp_index"
                stroke="#1976d2"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Kp Index"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Ap Index Forecast */}
      <Card
        sx={{
          backgroundColor: cardBg,
          color: textPrimary,
          mb: 4,
          borderRadius: 4,
          boxShadow: '0px 6px 16px rgba(0,0,0,0.15)'
        }}
      >
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              background: 'linear-gradient(90deg, #8e24aa, #ba68c8)',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold',
              mb: 2
            }}
          >
            📊 Ap Index Forecast
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" stroke={axisStroke} />
              <YAxis domain={[0, 40]} stroke={axisStroke} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: '1px solid #ccc',
                  color: tooltipText,
                  borderRadius: 6
                }}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="ap_index"
                stroke="#8e24aa"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Ap Index"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Solar Radiation Forecast */}
      <Card
        sx={{
          backgroundColor: cardBg,
          color: textPrimary,
          mb: 4,
          borderRadius: 4,
          boxShadow: '0px 6px 16px rgba(0,0,0,0.15)'
        }}
      >
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              background: 'linear-gradient(90deg, #388e3c, #66bb6a)',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold',
              mb: 2
            }}
          >
            ☀️ Solar Radiation Forecast
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" stroke={axisStroke} />
              <YAxis stroke={axisStroke} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: '1px solid #ccc',
                  color: tooltipText,
                  borderRadius: 6
                }}
              />
              <Legend />
              <Bar
                dataKey="solar_radiation"
                fill="#388e3c"
                name="Solar Radiation"
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Radio Blackout Forecast */}
      <Card
        sx={{
          backgroundColor: cardBg,
          color: textPrimary,
          borderRadius: 4,
          boxShadow: '0px 6px 16px rgba(0,0,0,0.15)'
        }}
      >
        <CardContent>
          <Typography
            variant="h6"
            gutterBottom
            sx={{
              background: 'linear-gradient(90deg, #d32f2f, #ef5350)',
              color: '#fff',
              px: 2,
              py: 1,
              borderRadius: 2,
              fontWeight: 'bold',
              mb: 2
            }}
          >
            📡 Radio Blackout Forecast
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#d32f2f" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#d32f2f" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridStroke} />
              <XAxis dataKey="date" stroke={axisStroke} />
              <YAxis domain={[0, 4]} stroke={axisStroke} />
              <Tooltip
                contentStyle={{
                  backgroundColor: tooltipBg,
                  border: '1px solid #ccc',
                  color: tooltipText,
                  borderRadius: 6
                }}
              />
              <Legend />
              <Area
                type="monotone"
                dataKey="radio_blackout_r1_r2_numeric"
                stroke="#d32f2f"
                fillOpacity={0.8}
                fill="url(#colorRB)"
                name="Radio Blackout R1-R2"
              />
              <Area
                type="monotone"
                dataKey="radio_blackout_r3_plus_numeric"
                stroke="#b71c1c"
                fillOpacity={0.5}
                fill="url(#colorRB)"
                name="Radio Blackout R3+"
              />
            </AreaChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    </Box>
  );
};

export default ForecastGraphs;
