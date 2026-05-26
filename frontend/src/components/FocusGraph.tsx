import React from 'react';

interface Props {
  scores: number[];
  width?: number;
  height?: number;
}

const FocusGraph: React.FC<Props> = ({ scores, width = 800, height = 150 }) => {
  const data = scores && scores.length > 0 ? scores.slice(-60) : [0];
  const paddingLeft = 40;
  const paddingRight = 20;
  const paddingTop = 20;
  const paddingBottom = 20;

  const points = data
    .map((d, i) => {
      const x =
        (i / Math.max(1, data.length - 1)) * (width - paddingLeft - paddingRight) +
        paddingLeft;
      const y =
        height - ((d / 100) * (height - paddingTop - paddingBottom) + paddingBottom);
      return `${x},${y}`;
    })
    .join(' ');

  const yLabels = [100, 75, 50, 25, 0];

  return (
    <div className="graph-wrapper">
      <svg
        width="100%"
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient id="focus-graph-gradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor="var(--focus)" stopOpacity="0.25" />
            <stop offset="100%" stopColor="var(--focus)" stopOpacity="0" />
          </linearGradient>
        </defs>
        {yLabels.map((label) => {
          const y =
            height -
            ((label / 100) * (height - paddingTop - paddingBottom) + paddingBottom);
          return (
            <g key={label}>
              <line
                x1={paddingLeft}
                y1={y}
                x2={width - paddingRight}
                y2={y}
                stroke="var(--border)"
                strokeWidth="1"
                strokeDasharray="4,4"
              />
              <text
                x={paddingLeft - 10}
                y={y + 4}
                textAnchor="end"
                fill="var(--text-faint)"
                fontSize="10"
                fontWeight="600"
              >
                {label}%
              </text>
            </g>
          );
        })}
        {data.length > 1 && (
          <>
            <path
              d={`M ${paddingLeft},${height - paddingBottom} ${points} L ${
                width - paddingRight
              },${height - paddingBottom} Z`}
              fill="url(#focus-graph-gradient)"
            />
            <polyline
              fill="none"
              stroke="var(--focus)"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
              points={points}
            />
          </>
        )}
      </svg>
    </div>
  );
};

export default FocusGraph;
