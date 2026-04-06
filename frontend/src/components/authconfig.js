export const msalConfig = {
    auth: {
        clientId: import.meta.env.VITE_AZURE_CLIENT_ID,
        authority: `https://login.microsoftonline.com/${import.meta.env.VITE_AZURE_TENANT_ID}`,
        redirectUri: "http://localhost:5173",
    }
};

export const loginRequest = {
    scopes: ["https://management.azure.com/user_impersonation"]
};