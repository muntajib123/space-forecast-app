// ForecastBreakdown3Hourly.js
import React from 'react';
import './ForecastBreakdown3Hourly.css'; // Optional: for styling

const ForecastBreakdown3Hourly = ({ kpIndex }) => {
  if (!kpIndex || kpIndex.length !== 24) return null;

  const headers = ['00-03UT', '03-06UT', '06-09UT', '09-12UT', '12-15UT', '15-18UT', '18-21UT', '21-00UT'];
  const days = ['Day 1', 'Day 2', 'Day 3'];
  const matrix = [[], [], []];

  kpIndex.forEach((val, i) => {
    const day = Math.floor(i / 8);
    matrix[day].push(val.toFixed(2));
  });

  return (
    <div className="three-hourly-table-container">
      <h2>3-Hourly Kp Index Forecast</h2>
      <table className="three-hourly-table">
        <thead>
          <tr>
            <th>UT</th>
            {days.map((day, i) => <th key={i}>{day}</th>)}
          </tr>
        </thead>
        <tbody>
          {headers.map((time, i) => (
            <tr key={i}>
              <td>{time}</td>
              {matrix.map((dayArr, j) => <td key={j}>{dayArr[i]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default ForecastBreakdown3Hourly;
