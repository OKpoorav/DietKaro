import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { weightLogsApi } from '../services/api';
import { WeightLog } from '../types';

export function useWeightLogs(limit?: number) {
    return useQuery({
        queryKey: ['weight-logs', limit],
        queryFn: async () => {
            const { data } = await weightLogsApi.getWeightLogs({ limit });
            return data.data;
        },
        staleTime: 0,
        gcTime: 30 * 1000,
    });
}

export function useCreateWeightLog() {
    const queryClient = useQueryClient();

    return useMutation({
        mutationFn: async (input: { weightKg: number; logDate: string; notes?: string }) => {
            const { data } = await weightLogsApi.createWeightLog(input);
            return data.data;
        },
        onSuccess: async (newWeightLog) => {
            queryClient.setQueryData(['weight-logs', 10], (oldData: WeightLog[] | undefined) => {
                if (!oldData) return [newWeightLog];
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

            await queryClient.invalidateQueries({ queryKey: ['client', 'stats'] });
        },
    });
}
