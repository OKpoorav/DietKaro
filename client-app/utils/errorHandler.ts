import { AxiosError } from 'axios';
import { ApiErrorResponse } from '../types';

export interface AppError {
    title: string;
    message: string;
    isRetryable: boolean;
    statusCode?: number;
}

function isAxiosError(error: unknown): error is AxiosError {
    return (error as AxiosError)?.isAxiosError === true;
}

function getHttpTitle(status: number): string {
    if (status === 401) return 'Session Expired';
    if (status === 403) return 'Access Denied';
    if (status === 404) return 'Not Found';
    if (status === 409) return 'Conflict';
    if (status === 422) return 'Validation Error';
    if (status === 429) return 'Too Many Requests';
    if (status >= 500) return 'Server Error';
    return 'Request Failed';
}

function getHttpMessage(status: number): string {
    if (status === 401) return 'Please log in again.';
    if (status === 403) return 'You do not have permission for this action.';
    if (status === 409) return 'This entry already exists.';
    if (status === 429) return 'Please wait a moment before trying again.';
    if (status >= 500) return 'Something went wrong on our end. Please try again.';
    return 'An error occurred. Please try again.';
}

/**
 * Normalizes any error into a structured AppError.
 * Handles AxiosErrors, network errors, timeouts, and generic JS errors.
 */
export function normalizeError(error: unknown): AppError {
    // Timeout
    if (isAxiosError(error) && error.code === 'ECONNABORTED') {
        return {
            title: 'Request Timeout',
            message: 'The server took too long to respond. Please try again.',
            isRetryable: true,
        };
    }

    // Axios error with response (server returned an error status)
    if (isAxiosError(error) && error.response) {
        const status = error.response.status;
        const apiError = error.response.data as ApiErrorResponse | undefined;
        const message = apiError?.message || getHttpMessage(status);

        return {
            title: getHttpTitle(status),
            message,
            isRetryable: status >= 500 || status === 408 || status === 429,
            statusCode: status,
        };
    }

    // Network error (no response received)
    if (isAxiosError(error) && !error.response) {
        return {
            title: 'Connection Error',
            message: 'Please check your internet connection and try again.',
            isRetryable: true,
        };
    }

    // Generic JS error
    if (error instanceof Error) {
        return {
            title: 'Error',
            message: error.message,
            isRetryable: false,
        };
    }

    return {
        title: 'Unexpected Error',
        message: 'Something went wrong. Please try again.',
        isRetryable: true,
    };
}
