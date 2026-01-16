import * as SecureStore from 'expo-secure-store';

const TOKEN_KEY = 'auth_token';
const CLIENT_KEY = 'client_data';
const LAST_ACTIVITY_KEY = 'last_activity';

export const authStore = {
    async getToken(): Promise<string | null> {
        try {
            return await SecureStore.getItemAsync(TOKEN_KEY);
        } catch {
            return null;
        }
    },

    async setToken(token: string): Promise<void> {
        await SecureStore.setItemAsync(TOKEN_KEY, token);
        await this.updateLastActivity();
    },

    async removeToken(): Promise<void> {
        await SecureStore.deleteItemAsync(TOKEN_KEY);
        await SecureStore.deleteItemAsync(CLIENT_KEY);
        await SecureStore.deleteItemAsync(LAST_ACTIVITY_KEY);
    },

    async getClientData(): Promise<Record<string, unknown> | null> {
        try {
            const data = await SecureStore.getItemAsync(CLIENT_KEY);
            return data ? JSON.parse(data) : null;
        } catch {
            return null;
        }
    },

    async setClientData(client: Record<string, unknown>): Promise<void> {
        await SecureStore.setItemAsync(CLIENT_KEY, JSON.stringify(client));
    },

    async updateLastActivity(): Promise<void> {
        await SecureStore.setItemAsync(LAST_ACTIVITY_KEY, Date.now().toString());
    },

    async checkSessionExpiry(): Promise<boolean> {
        try {
            const lastActivity = await SecureStore.getItemAsync(LAST_ACTIVITY_KEY);
            if (!lastActivity) return true;

            const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;
            const elapsed = Date.now() - parseInt(lastActivity, 10);
            return elapsed > thirtyDaysMs;
        } catch {
            return true;
        }
    },
};
