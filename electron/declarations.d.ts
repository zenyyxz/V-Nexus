declare module 'sudo-prompt' {
    interface SudoOptions {
        name?: string
        icns?: string // macOS
    }

    function exec(
        command: string,
        options?: SudoOptions,
        callback?: (error: Error | null, stdout: string | Buffer, stderr: string | Buffer) => void
    ): void
}

declare module 'default-gateway' {
    const value: any;
    export = value;
}
