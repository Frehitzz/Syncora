import type { AuthLayoutProps } from '@/types';

// ========== Auth Split Layout ===========
// A split-screen layout for authentication pages, showing a branding image on one side (desktop) and forms on the other.
export default function AuthSplitLayout({
    children,
    title,
    description,
    image,
}: AuthLayoutProps) {
    return (
        <div className="relative grid h-dvh flex-col items-center justify-center px-8 sm:px-0 lg:max-w-none lg:grid-cols-2 lg:px-0">
            <div className="relative hidden h-full flex-col bg-muted text-white lg:flex dark:border-r">
                <img
                    src={image || '/images/register-image.png'}
                    alt="Background"
                    className="absolute inset-0 h-full w-full object-cover"
                />
            </div>
            <div className="w-full lg:p-8">
                <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
                    <div className="flex flex-col items-start gap-2 text-left sm:items-center sm:text-center">
                        <h1 className="font-heading text-5xl tracking-wider text-primary">
                            {title}
                        </h1>
                        <p className="font-sans text-sm text-balance text-muted-foreground">
                            {description}
                        </p>
                    </div>
                    {children}
                </div>
            </div>
        </div>
    );
}
