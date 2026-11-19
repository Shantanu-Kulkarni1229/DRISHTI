import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceDot, ResponsiveContainer } from 'recharts';

interface Point {
  threshold: number;
  precision: number;
  recall: number;
}

export function PRCurve({ points, operatingThreshold }: { points: Point[]; operatingThreshold: number }) {
  const data = points.map((p) => ({ recall: p.recall, precision: p.precision, threshold: p.threshold }));
  const nearest = points.reduce((best, p) => (Math.abs(p.threshold - operatingThreshold) < Math.abs(best.threshold - operatingThreshold) ? p : best), points[0]);

  return (
    <ResponsiveContainer width="100%" height={220}>
      <LineChart data={data} margin={{ top: 8, right: 12, bottom: 4, left: -18 }}>
        <CartesianGrid stroke="var(--color-border-subtle)" strokeDasharray="3 3" />
        <XAxis
          dataKey="recall"
          type="number"
          domain={[0, 1]}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
          stroke="var(--color-border)"
          label={{ value: 'Recall', position: 'insideBottom', offset: -2, fill: 'var(--color-text-muted)', fontSize: 10 }}
        />
        <YAxis
          domain={[0, 1]}
          tick={{ fill: 'var(--color-text-muted)', fontSize: 10 }}
          stroke="var(--color-border)"
          label={{ value: 'Precision', angle: -90, position: 'insideLeft', fill: 'var(--color-text-muted)', fontSize: 10 }}
        />
        <Tooltip
          contentStyle={{ background: 'var(--color-bg-raised)', border: '1px solid var(--color-border)', fontSize: 11, borderRadius: 6 }}
          formatter={(value, name) => [Number(value).toFixed(2), String(name)]}
          labelFormatter={(_, payload) => `threshold ${payload?.[0]?.payload?.threshold ?? ''}`}
        />
        <Line type="monotone" dataKey="precision" stroke="var(--color-accent-soft)" strokeWidth={2} dot={false} />
        {nearest && (
          <ReferenceDot
            x={nearest.recall}
            y={nearest.precision}
            r={5}
            fill="var(--color-status-warn)"
            stroke="white"
            strokeWidth={1.5}
          />
        )}
      </LineChart>
    </ResponsiveContainer>
  );
}
