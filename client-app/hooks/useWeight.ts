import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { weightLogsApi } from '../services/api';
import { WeightLog } from '../types';

export function useWeightLogs(limit?: number) {
    return useQuery({
        queryKey: ['weight-logs', limit],
        queryFn: async () => {
            const { data } = await weightLogsApi.getWeightLogs({ limit });
            return data.data as WeightLog[];
        },
        staleTime: 0, // Always refetch fresh data
        gcTime: 30 * 1000, // Cache for 30 seconds (was cacheTime in v4)
    });
}

export function useCreateWeightLog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { weightKg: number; logDate: string; notes?: string }) => {
            const { data } = await weightLogsApi.createWeightLog(input);
            return data.data as WeightLog;
        },
        onSuccess: async (newWeightLog) => {
            // Update the weight-logs cache directly with new data
            queryClient.setQueryData(['weight-logs', 10], (oldData: WeightLog[] | undefined) => {
                if (!oldData) return [newWeightLog];
                // Replace or add the new log
                const existingIndex = oldData.findIndex(
                    log => log.logDate === newWeightLog.logDate
                );
                if (existingIndex >= 0) {
                    const newData = [...oldData];
                    newData[existingIndex] = newWeightLog;
                    return newData;
                }
                return [newWeightLog, ...oldData].slice(0, 10);
            });

            // Also invalidate stats to update currentWeight
            await queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
        },
    });
}
