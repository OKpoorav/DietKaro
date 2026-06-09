import { useCallback, useEffect, useState } from 'react';
import api from '../services/api';
import { UpcomingConsultation } from '../types';

interface UseUpcomingConsultationsResult {
    consultations: UpcomingConsultation[];
    loading: boolean;
    refresh: () => Promise<void>;
}

export function useUpcomingConsultations(): UseUpcomingConsultationsResult {
    const [consultations, setConsultations] = useState<UpcomingConsultation[]>([]);
    const [loading, setLoading] = useState(true);

    const refresh = useCallback(async () => {
        try {
            const res = await api.get('/client/consultations/upcoming');
            setConsultations(res.data.data ?? []);
        } catch {
            // keep previous state on error
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        refresh();
    }, [refresh]);

    return { consultations, loading, refresh };
}
