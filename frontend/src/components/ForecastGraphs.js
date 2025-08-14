// src/components/ForecastGraphs.js
import React from 'react';
import {
  LineChart, Line,
  BarChart, Bar,
  AreaChart, Area,
  XAxis, YAxis,
  Tooltip, Legend,
  CartesianGrid, ResponsiveContainer
} from 'recharts';

import {
  Card,
  CardContent,
  Typography,
  Box
} from '@mui/material';

const ForecastGraphs = ({ data }) => {
  return (
    <Box sx={{ mt: 4 }}>
      {/* Kp Index Forecast */}
      <Card sx={{ backgroundColor: '#1a1a1a', color: '#fff', mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: '#60a5fa' }}>
            🛰️ Kp Index Forecast
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2f3747" />
              <XAxis dataKey="date" stroke="#9db4d3" />
              <YAxis domain={[0, 10]} stroke="#9db4d3" />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", color: "#fff" }} />
              <Legend />
              <Line
                type="monotone"
                dataKey="kp_index"
                stroke="#3b82f6"
                strokeWidth={3}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
                name="Kp Index"
              />
            </LineChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Solar Radiation Forecast */}
      <Card sx={{ backgroundColor: '#1a1a1a', color: '#fff', mb: 4 }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: '#4ade80' }}>
            ☀️ Solar Radiation Forecast
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke="#2f3747" />
              <XAxis dataKey="date" stroke="#9db4d3" />
              <YAxis stroke="#9db4d3" />
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", color: "#fff" }} />
              <Legend />
              <Bar
                dataKey="solar_radiation"
                fill="#22c55e"
                name="Solar Radiation"
                barSize={40}
              />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>

      {/* Radio Blackout Forecast */}
      <Card sx={{ backgroundColor: '#1a1a1a', color: '#fff' }}>
        <CardContent>
          <Typography variant="h6" gutterBottom sx={{ color: '#fb7185' }}>
            📡 Radio Blackout Forecast
          </Typography>
          <ResponsiveContainer width="100%" height={300}>
            <AreaChart data={data}>
              <defs>
                <linearGradient id="colorRB" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.8} />
                  <stop offset="95%" stopColor="#f43f5e" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#2f3747" />
              <XAxis dataKey="date" stroke="#9db4d3" />
              <YAxis domain={[0, 4]} stroke="#9db4d3" /> {/* Domain adjusted for severity scale */}
              <Tooltip contentStyle={{ backgroundColor: "#1e293b", border: "none", color: "#fff" }} />
              <Legend />
              <Area
                type="monotone"
                dataKey="radio_blackout_r1_r2_numeric"
                stroke="#f43f5e"
                fillOpacity={0.8}
                fill="url(#colorRB)"
                name="Radio Blackout R1-R2"
              />
              <Area
                type="monotone"
                dataKey="radio_blackout_r3_plus_numeric"
                stroke="#fb7185"
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
