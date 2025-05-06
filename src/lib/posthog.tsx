import type { ReactNode } from "@tanstack/react-router";
import { PostHogProvider } from 'posthog-js/react'
import type { FC } from "react";

type Props = {
    children: ReactNode;
}

export const LoggingProvider:FC<Props> = ({ children }) => {
    if (import.meta.env.ENV === 'production') {
        return (
            <PostHogProvider
                apiKey={import.meta.env.VITE_PUBLIC_POSTHOG_KEY}
                options={{
                api_host: import.meta.env.VITE_PUBLIC_POSTHOG_HOST,
                debug: import.meta.env.MODE === 'development',
                }}
            >
                {children}
            </PostHogProvider>
        )
    }

    return children;
}