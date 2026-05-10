import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api/use-api-client';

export type CalendarConsultation = {
    id: string;
    title: string | null;
    scheduledAt: string;
    durationMin: number;
    mode: 'online' | 'in_person';
    status: 'scheduled' | 'completed' | 'cancelled';
    meetLink?: string | null;
    location?: string | null;
    notes?: string | null;
    client: { id: string; fullName: string; phone: string };
};

export type CalendarFollowup = {
    id: string;
    dueAt: string;
    type: 'call' | 'visit' | 'todo';
    notes?: string | null;
    outcome?: string | null;
    completedAt: string | null;
    lead: {
        id: string;
        name: string;
        primaryMobile: string;
        status: { name: string; color: string };
    };
};

export type CalendarData = {
    consultations: CalendarConsultation[];
    followups: CalendarFollowup[];
};

export function useCalendarEvents(start: Date, end: Date) {
    const api = useApiClient();
    const startKey = start.toISOString().split('T')[0];
    const endKey = end.toISOString().split('T')[0];

    return useQuery({
        queryKey: ['calendar', startKey, endKey],
        queryFn: async () => {
            const { data } = await api.get('/calendar/events', {
                params: { start: start.toISOString(), end: end.toISOString() },
            });
            return data.data as CalendarData;
        },
        staleTime: 2 * 60 * 1000,
    });
}

export function useUpdateCalendarConsultation() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, ...data }: { id: string; status?: string }) => {
            const res = await api.patch(`/calendar/consultations/${id}`, data);
            return res.data.data as CalendarConsultation;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['calendar'] });
            qc.invalidateQueries({ queryKey: ['consultations'] });
        },
    });
}

export function useCompleteFollowup() {
    const api = useApiClient();
    const qc = useQueryClient();
    return useMutation({
        mutationFn: async ({ id, outcome }: { id: string; outcome?: string }) => {
            const res = await api.patch(`/calendar/followups/${id}`, {
                completedAt: new Date().toISOString(),
                outcome,
            });
            return res.data.data as CalendarFollowup;
        },
        onSuccess: () => {
            qc.invalidateQueries({ queryKey: ['calendar'] });
        },
    });
}
