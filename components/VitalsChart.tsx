import React from 'react';
import type { VitalSign } from '../types';

interface ChartDataPoint {
    time: number; // minutes from first reading
    value: number;
    value2?: number; // For diastolic BP
    originalTime: string;
}

const Chart: React.FC<{
    data: ChartDataPoint[];
    title: string;
    color: string;
    color2?: string;
    height?: number;
    yRange: [number, number];
    yLabel: string;
}> = ({ data, title, color, color2, height = 150, yRange, yLabel }) => {
    const padding = { top: 20, right: 10, bottom: 30, left: 35 };
    const width = 400;

    if (data.length < 2) {
        return (
            <div style={{ height: `${height}px` }} className="flex items-center justify-center bg-gray-50 dark:bg-gray-700/50 rounded-lg">
                <p className="text-sm text-gray-500">{title}: Not enough data to plot</p>
            </div>
        );
    }

    const xMax = data[data.length - 1].time;
    const [yMin, yMax] = yRange;

    const toSvgX = (time: number) => padding.left + (time / xMax) * (width - padding.left - padding.right);
    const toSvgY = (val: number) => height - padding.bottom - ((val - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);

    const linePath = data.map(p => `${toSvgX(p.time)},${toSvgY(p.value)}`).join(' L');
    const linePath2 = data.map(p => p.value2 ? `${toSvgX(p.time)},${toSvgY(p.value2)}` : null).filter(Boolean).join(' L');

    // Y-axis ticks
    const yTicks = [yMin, yMin + (yMax - yMin) / 2, yMax];

    return (
        <div>
            <h4 className="text-center font-semibold text-sm text-gray-600 dark:text-gray-300 mb-1">{title}</h4>
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                {/* Y-axis */}
                <line x1={padding.left} y1={padding.top} x2={padding.left} y2={height - padding.bottom} className="stroke-gray-300 dark:stroke-gray-600" />
                {yTicks.map(tick => (
                    <g key={tick}>
                        <line x1={padding.left - 5} y1={toSvgY(tick)} x2={padding.left} y2={toSvgY(tick)} className="stroke-gray-300 dark:stroke-gray-600" />
                        <text x={padding.left - 8} y={toSvgY(tick)} dy="0.3em" textAnchor="end" className="text-[10px] fill-gray-500 dark:fill-gray-400">{Math.round(tick)}</text>
                    </g>
                ))}
                 <text transform={`translate(12, ${height / 2}) rotate(-90)`} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400">{yLabel}</text>


                {/* X-axis */}
                <line x1={padding.left} y1={height - padding.bottom} x2={width - padding.right} y2={height - padding.bottom} className="stroke-gray-300 dark:stroke-gray-600" />
                 {data.map((p, i) => (
                    (i === 0 || i === data.length - 1) &&
                    <text key={p.time} x={toSvgX(p.time)} y={height - padding.bottom + 15} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400">{p.originalTime}</text>
                ))}
                <text x={width/2} y={height - 5} textAnchor="middle" className="text-[10px] fill-gray-500 dark:fill-gray-400">Time</text>
                
                {/* Data lines */}
                {linePath2 && <path d={`M${linePath2}`} stroke={color2} strokeWidth="2" fill="none" />}
                <path d={`M${linePath}`} stroke={color} strokeWidth="2" fill="none" />

                {/* Data points */}
                {data.map(p => (
                    <React.Fragment key={p.time}>
                        {p.value2 && <circle cx={toSvgX(p.time)} cy={toSvgY(p.value2)} r="3" fill={color2} />}
                        <circle cx={toSvgX(p.time)} cy={toSvgY(p.value)} r="3" fill={color} />
                    </React.Fragment>
                ))}
            </svg>
        </div>
    );
};

const VitalsChart: React.FC<{ vitals: VitalSign[] }> = ({ vitals }) => {
    if (vitals.length === 0) return null;

    const timeToMinutes = (time: string): number => {
        const [h, m] = time.split(':').map(Number);
        return h * 60 + m;
    };

    const firstTime = vitals.length > 0 ? timeToMinutes(vitals[0].time) : 0;

    const chartData = vitals.map(v => ({
        hr: Number(v.hr) || 0,
        rr: Number(v.rr) || 0,
        systolic: Number(v.bp.split('/')[0]) || 0,
        diastolic: Number(v.bp.split('/')[1]) || 0,
        spo2: Number(v.spo2) || 0,
        time: timeToMinutes(v.time) - firstTime,
        originalTime: v.time,
    }));
    
    return (
        <div className="bg-white dark:bg-gray-800 p-4 rounded-lg shadow mb-6">
            <h2 className="text-xl font-bold text-ams-blue dark:text-ams-light-blue mb-4">Observation Trends</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Chart data={chartData.map(d => ({ time: d.time, value: d.hr, originalTime: d.originalTime }))} title="Heart Rate" color="#ef4444" yRange={[30, 180]} yLabel="bpm" />
                <Chart data={chartData.map(d => ({ time: d.time, value: d.systolic, value2: d.diastolic, originalTime: d.originalTime }))} title="Blood Pressure" color="#3b82f6" color2="#60a5fa" yRange={[40, 220]} yLabel="mmHg" />
                <Chart data={chartData.map(d => ({ time: d.time, value: d.rr, originalTime: d.originalTime }))} title="Respiratory Rate" color="#22c55e" yRange={[0, 40]} yLabel="breaths/min" />
                <Chart data={chartData.map(d => ({ time: d.time, value: d.spo2, originalTime: d.originalTime }))} title="Oxygen Saturation" color="#f97316" yRange={[80, 100]} yLabel="%" />
            </div>
        </div>
    );
};

export default VitalsChart;