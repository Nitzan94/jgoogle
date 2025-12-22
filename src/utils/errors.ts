// ABOUTME: Standardized exit codes for CLI
// ABOUTME: Enables LLM/agents to understand and handle errors

export const ExitCode = {
    SUCCESS: 0,
    AUTH_ERROR: 1,      // invalid_grant, token expired, account not found
    NETWORK_ERROR: 2,   // Connection failed, timeout
    NOT_FOUND: 3,       // Email, file, event not found
    INVALID_INPUT: 4,   // Missing args, bad format
    API_ERROR: 5,       // Google API error (quota, permissions)
} as const;

export type ExitCodeType = typeof ExitCode[keyof typeof ExitCode];

export function exitWithCode(code: ExitCodeType, message?: string): never {
    if (message) {
        console.error(`[ERROR] ${message}`);
    }
    process.exit(code);
}

// Error messages that help LLM understand what to do
export const ErrorMessages = {
    [ExitCode.AUTH_ERROR]: 'Google auth failed. Run: jgoogle accounts add <email>',
    [ExitCode.NETWORK_ERROR]: 'Connection failed. Check internet connection.',
    [ExitCode.NOT_FOUND]: 'Not found. Check the ID/query and try again.',
    [ExitCode.INVALID_INPUT]: 'Invalid input. Check command usage with: jgoogle --help',
    [ExitCode.API_ERROR]: 'Google API error. Check permissions or quota.',
} as const;
