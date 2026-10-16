// Keep the stored service key for existing cases; it denotes periodic service.
// UI, authenticated HTTP and MCP expose only these two hospital request types.
export const hospitalRequestKinds={fault:'اعلام خرابی',service:'سرویس دوره‌ای'} as const;
