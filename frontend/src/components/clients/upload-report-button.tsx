'use client';

import { useRef } from 'react';
import { Loader2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import {
    useUploadClientReport,
    validateReportFile,
    ACCEPTED_REPORT_MIMES,
} from '@/lib/hooks/use-upload-client-report';

interface UploadReportButtonProps {
    clientId: string;
    size?: 'sm' | 'md';
    className?: string;
}

export function UploadReportButton({ clientId, size = 'sm', className = '' }: UploadReportButtonProps) {
    const inputRef = useRef<HTMLInputElement>(null);
    const upload = useUploadClientReport(clientId);

    const handleClick = () => inputRef.current?.click();

    const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        e.target.value = ''; // Allow re-selecting the same file later
        if (!file) return;

        const error = validateReportFile(file);
        if (error) {
            toast.error(error);
            return;
        }

        try {
            await upload.mutateAsync({ file });
            toast.success(`Uploaded "${file.name}"`);
        } catch (err: unknown) {
            const message =
                (err as { response?: { data?: { error?: { message?: string } } } })
                    ?.response?.data?.error?.message ?? 'Upload failed';
            toast.error(message);
        }
    };

    const isPending = upload.isPending;
    const heightClass = size === 'sm' ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm';

    return (
        <>
            <input
                ref={inputRef}
                type="file"
                accept={ACCEPTED_REPORT_MIMES.join(',')}
                onChange={handleChange}
                className="hidden"
            />
            <button
                type="button"
                onClick={handleClick}
                disabled={isPending}
                aria-label="Upload report for this client"
                className={`inline-flex items-center gap-1.5 ${heightClass} rounded-lg bg-brand text-white font-medium hover:bg-brand/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed ${className}`}
            >
                {isPending ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                    <Upload className="w-3.5 h-3.5" />
                )}
                {isPending ? 'Uploading…' : 'Upload'}
            </button>
        </>
    );
}
