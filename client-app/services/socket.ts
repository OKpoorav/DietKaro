import { io, Socket } from 'socket.io-client';
import { authStore } from '../store/authStore';
import Constants from 'expo-constants';

let socket: Socket | null = null;

function getSocketUrl(): string {
    const configuredUrl = Constants.expoConfig?.extra?.apiUrl;
    if (configuredUrl) {
        // Strip /api/v1 suffix since socket.io connects to root
        return configuredUrl.replace(/\/api\/v1$/, '');
    }
    if (__DEV__) return 'http://localhost:3000';
    throw new Error('Socket URL not configured');
}

export function getSocket(): Socket | null {
    return socket;
}

export async function connectSocket(): Promise<Socket> {
    if (socket?.connected) return socket;

    if (socket) {
        socket.removeAllListeners();
        socket.disconnect();
        socket = null;
    }

    const token = await authStore.getToken();
    if (!token) throw new Error('No auth token');

    socket = io(getSocketUrl(), {
        auth: async (cb: (data: object) => void) => {
            const latestToken = await authStore.getToken();
            cb({ type: 'client', token: latestToken });
        },
        transports: ['websocket'],
        reconnection: true,
        reconnectionAttempts: 10,
        reconnectionDelay: 2000,
    });

    return socket;
}

export function disconnectSocket() {
    if (socket) {
        socket.disconnect();
        socket = null;
    }
}
