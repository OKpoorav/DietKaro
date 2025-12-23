'use client';

import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

// Redirect to clients page - new client is handled via modal
export default function NewClientPage() {
    const router = useRouter();

    useEffect(() => {
        router.replace('/dashboard/clients');
    }, [router]);

    return (
        <div className="flex items-center justify-center h-64">
            <p className="text-gray-500">Redirecting...</p>
        </div>
    );
}
