interface WeightEntry {
    weightKg: number | string | { toString(): string };
}

export function calculateWeightTrend(
    weightLogs: WeightEntry[]
): 'up' | 'down' | 'stable' {
    if (weightLogs.length >= 4) {
        const midpoint = Math.floor(weightLogs.length / 2);
        const recentEntries = weightLogs.slice(0, midpoint);
        const olderEntries = weightLogs.slice(midpoint);

        const avg = (entries: WeightEntry[]) =>
            entries.reduce((sum, l) => sum + Number(l.weightKg), 0) / entries.length;

        const diff = avg(recentEntries) - avg(olderEntries);
        if (diff > 0.3) return 'up';
        if (diff < -0.3) return 'down';
        return 'stable';
    }

    if (weightLogs.length >= 2) {
        const diff = Number(weightLogs[0].weightKg) - Number(weightLogs[weightLogs.length - 1].weightKg);
        if (diff > 0.5) return 'up';
        if (diff < -0.5) return 'down';
    }

    return 'stable';
}
