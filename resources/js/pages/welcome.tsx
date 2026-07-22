import { Head, Link, usePage } from '@inertiajs/react';
import { Moon, Sun } from 'lucide-react';
import { useAppearance } from '@/hooks/use-appearance';
import { dashboard, login, register } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props;
    const { resolvedAppearance, updateAppearance } = useAppearance();

    const toggleTheme = () => {
        updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark');
    };

    return (
        <>
            <Head title="Welcome to Syncora" />
            <div className="relative flex min-h-screen flex-col overflow-hidden bg-background text-foreground">
                {/* Header */}
                <header className="flex w-full items-center justify-between p-6 lg:px-12">
                    <div className="flex flex-1 justify-start">
                        <Link
                            href="/"
                            className="font-heading text-5xl text-accent dark:text-accent-alt"
                        >
                            SC
                        </Link>
                    </div>

                    <nav className="hidden items-center justify-center gap-10 text-sm font-medium tracking-wide md:flex">
                        <Link
                            href="/"
                            className="transition-colors hover:text-accent"
                        >
                            Home
                        </Link>
                        <Link
                            href="#"
                            className="transition-colors hover:text-accent"
                        >
                            About
                        </Link>
                        <Link
                            href="#"
                            className="transition-colors hover:text-accent"
                        >
                            Contact
                        </Link>
                    </nav>

                    <div className="flex flex-1 items-center justify-end text-sm font-medium">
                        <button
                            onClick={toggleTheme}
                            className="rounded-full p-2 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                            aria-label="Toggle dark mode"
                        >
                            {resolvedAppearance === 'dark' ? (
                                <Sun className="h-5 w-5" />
                            ) : (
                                <Moon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </header>

                {/* Main Content */}
                <main className="relative flex flex-1 flex-col items-center justify-center px-4 text-center">
                    {/* Centered Background Illustrations */}
                    <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
                        <img
                            src="/images/connecting-illustration.png"
                            alt=""
                            className="w-[120%] max-w-none opacity-80 blur-[2px] md:w-[800px] md:max-w-6xl dark:hidden"
                        />
                        <img
                            src="/images/connecting-illustration-dark.png"
                            alt=""
                            className="hidden w-[120%] max-w-none opacity-60 blur-[2px] md:w-[800px] md:max-w-6xl dark:block"
                        />
                    </div>

                    {/* Text Container */}
                    <div className="relative z-10 flex max-w-5xl flex-col items-center justify-center">
                        <p className="mb-2 text-xl font-medium tracking-wide text-secondary-foreground md:text-5xl">
                            Conversations That Happen in Real Time
                        </p>

                        <h1 className="mb-6 font-heading text-[6rem] leading-none font-bold text-accent drop-shadow-2xl md:text-[9rem] dark:text-accent-alt">
                            Syncora
                        </h1>

                        <p className="max-w-2xl text-base leading-relaxed text-foreground md:text-lg">
                            Whether you're chatting with friends, collaborating
                            with a team, or sharing ideas, enjoy a messaging
                            experience that feels natural, responsive, and
                            always in sync.
                        </p>

                        <div className="mt-10 flex items-center justify-center gap-4 text-base font-medium">
                            {auth.user ? (
                                <Link
                                    href={dashboard()}
                                    className="rounded-md bg-accent px-8 py-3.5 text-primary-foreground transition-colors hover:bg-accent/90 dark:bg-accent-alt dark:hover:bg-accent-alt/90"
                                >
                                    Dashboard
                                </Link>
                            ) : (
                                <>
                                    <Link
                                        href={login()}
                                        className="rounded-md border border-white/20 bg-background/30 px-8 py-3.5 shadow-sm backdrop-blur-md transition-colors hover:bg-background/50 dark:border-white/10 dark:bg-background/20 dark:hover:bg-background/30"
                                    >
                                        Log in
                                    </Link>
                                    <Link
                                        href={register()}
                                        className="rounded-md bg-accent px-8 py-3.5 text-primary-foreground shadow-lg transition-colors hover:bg-accent/90 dark:bg-accent-alt dark:hover:bg-accent-alt/90"
                                    >
                                        Register
                                    </Link>
                                </>
                            )}
                        </div>
                    </div>
                </main>
            </div>
        </>
    );
}
