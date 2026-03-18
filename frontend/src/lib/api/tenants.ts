// frontend/src/lib/api/tenants.ts
import { apiClient } from "./client";

export const tenantsApi = {
    list: async () => {
        const res = await apiClient.get("/tenants/");
        return res.data.tenants;
    },

    create: async (payload: {
        name: string; slug: string; plan: string;
        admin_name: string; admin_email: string; admin_password: string;
        custom_domain?: string;
    }) => {
        const res = await apiClient.post("/tenants/", payload);
        return res.data;
    },

    getByDomain: async (domain: string) => {
        // Usado pelo middleware para resolver o tenant
        const res = await apiClient.get("/tenants/by-domain", {
            params: { domain },
        });
        return res.data;
    },
};