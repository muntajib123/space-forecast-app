import React from 'react';
import {
  Box,
  Card,
  CardContent,
  Typography,
  Grid,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Paper,
} from '@mui/material';

const ForecastDisplay = ({ forecast }) => {
  if (!forecast?.length) {
    return (
      <Typography variant="body1" align="center" sx={{ color: '#ccc', mt: 2 }}>
        No forecast data available.
      </Typography>
    );
  }

  const formatRadioBlackout = (rb) => {
    if (rb && typeof rb === 'object') {
      const r1 = rb['R1-R2'] ?? 'N/A';
      const r3 = rb['R3 or greater'] ?? 'N/A';
      return `📡 R1-R2: ${r1}, R3+: ${r3}`;
    }
    return `📡 ${String(rb)}`;
  };

  return (
    <Box
      sx={{
        backgroundImage: "url('/space-bg.jpg')",
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        minHeight: '100vh',
        p: { xs: 2, sm: 4 },
        color: '#fff',
      }}
    >
      <Typography
        variant="h4"
        align="center"
        gutterBottom
        sx={{ color: '#fff', fontWeight: 'bold' }}
      >
        🌌 3-Day Space Weather Forecast
      </Typography>

      {/* Cards */}
      <Grid container spacing={3} justifyContent="center" sx={{ mt: 2 }}>
        {forecast.map((item, index) => (
          <Grid item xs={12} sm={6} md={4} key={index}>
            <Card
              sx={{
                backgroundColor: 'rgba(0, 0, 0, 0.75)',
                color: '#fff',
                boxShadow: 5,
                borderRadius: 3,
              }}
            >
              <CardContent>
                <Typography variant="h6">{item.day}</Typography>
                <Typography variant="body2" sx={{ color: '#ccc' }}>
                  {item.date}
                </Typography>
                <Typography mt={1}>
                  🌡 <strong>Kp Index:</strong> {item.kp_index?.toFixed(2) ?? 'N/A'}
                </Typography>
                <Typography>
                  ☀️ <strong>Solar Radiation:</strong> {item.solar_radiation?.toFixed(2) ?? 'N/A'}
                </Typography>
                <Typography>{formatRadioBlackout(item.radio_blackout)}</Typography>
              </CardContent>
            </Card>
          </Grid>
        ))}
      </Grid>

      {/* Table */}
      <Box mt={6}>
        <TableContainer
          component={Paper}
          sx={{
            backgroundColor: 'rgba(0, 0, 0, 0.8)',
            borderRadius: 2,
            overflow: 'hidden',
          }}
        >
          <Table>
            <TableHead>
              <TableRow>
                <TableCell sx={{ color: '#90caf9' }}>📅 Day & Date</TableCell>
                <TableCell sx={{ color: '#90caf9' }}>🌡 Kp Index</TableCell>
                <TableCell sx={{ color: '#90caf9' }}>☀️ Solar Radiation</TableCell>
                <TableCell sx={{ color: '#90caf9' }}>📡 Radio Blackout</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {forecast.map((item, index) => (
                <TableRow key={index}>
                  <TableCell sx={{ color: '#fff' }}>
                    <strong>{item.day}</strong>
                    <br />
                    <span style={{ color: '#bbb', fontSize: '0.875rem' }}>
                      {item.date}
                    </span>
                  </TableCell>
                  <TableCell sx={{ color: '#fff' }}>
                    {item.kp_index?.toFixed(2) ?? 'N/A'}
                  </TableCell>
                  <TableCell sx={{ color: '#fff' }}>
                    {item.solar_radiation?.toFixed(2) ?? 'N/A'}
                  </TableCell>
                  <TableCell sx={{ color: '#fff' }}>
                    {formatRadioBlackout(item.radio_blackout)}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Box>
  );
};

export default ForecastDisplay;
