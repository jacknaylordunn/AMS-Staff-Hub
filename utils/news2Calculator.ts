
import type { VitalSign } from '../types';

export const calculateNews2Score = (vitals: Partial<VitalSign>): number | undefined => {
    const { rr, spo2, onOxygen, bp, hr, avpu, temp } = vitals;

    if ([rr, spo2, bp, hr, avpu, temp].some(v => v === undefined || v === null || v === '')) {
        return undefined;
    }

    let score = 0;
    const numRR = Number(rr);
    const numSpo2 = Number(spo2);
    const numHr = Number(hr);
    const numTemp = Number(temp);
    const systolicBP = Number(bp?.split('/')[0]);

    // Respiration Rate
    if (numRR <= 8) score += 3;
    else if (numRR >= 9 && numRR <= 11) score += 1;
    else if (numRR >= 21 && numRR <= 24) score += 2;
    else if (numRR >= 25) score += 3;

    // SpO2
    if (numSpo2 <= 91) score += 3;
    else if (numSpo2 >= 92 && numSpo2 <= 93) score += 2;
    else if (numSpo2 >= 94 && numSpo2 <= 95) score += 1;

    // Supplemental Oxygen
    if (onOxygen) score += 2;

    // Systolic BP
    if (systolicBP <= 90) score += 3;
    else if (systolicBP >= 91 && systolicBP <= 100) score += 2;
    else if (systolicBP >= 101 && systolicBP <= 110) score += 1;
    else if (systolicBP >= 220) score += 3;

    // Heart Rate
    if (numHr <= 40) score += 3;
    else if (numHr >= 41 && numHr <= 50) score += 1;
    else if (numHr >= 91 && numHr <= 110) score += 1;
    else if (numHr >= 111 && numHr <= 130) score += 2;
    else if (numHr >= 131) score += 3;
    
    // Consciousness
    if (avpu !== 'Alert') score += 3;
    
    // Temperature
    if (numTemp <= 35.0) score += 3;
    else if (numTemp >= 35.1 && numTemp <= 36.0) score += 1;
    else if (numTemp >= 38.1 && numTemp <= 39.0) score += 1;
    else if (numTemp >= 39.1) score += 2;

    return score;
};

export const getNews2RiskColor = (score: number | undefined | null): string => {
    if (score === null || score === undefined) return 'bg-gray-400';
    if (score >= 7) return 'bg-red-600'; // High risk
    if (score >= 5) return 'bg-orange-500'; // Medium risk
    if (score >= 1) return 'bg-yellow-500'; // Low-medium risk
    return 'bg-green-500'; // Low risk
}