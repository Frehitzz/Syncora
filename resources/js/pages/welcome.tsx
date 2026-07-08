import { Head, Link, usePage } from '@inertiajs/react';
import { dashboard, login, register } from '@/routes';

export default function Welcome() {
    const { auth } = usePage().props;

    return (
        <>
            <Head title="Welcome to Syncora" />
            <div className="flex min-h-screen flex-col bg-background text-foreground">
                {/* Header */}
                <header className="flex w-full items-center justify-between p-6 lg:px-12">
                    <div className="flex flex-1 justify-start">
                        <Link href="/" className="font-heading text-5xl text-accent dark:text-accent-alt">
                            SC
                        </Link>
                    </div>

                    <nav className="hidden md:flex items-center justify-center gap-10 text-sm font-medium tracking-wide">
                        <Link href="/" className="transition-colors hover:text-accent">
                            Home
                        </Link>
                        <Link href="#" className="transition-colors hover:text-accent">
                            About
                        </Link>
                        <Link href="#" className="transition-colors hover:text-accent">
                            Contact
                        </Link>
                    </nav>

                    <div className="flex flex-1 justify-end gap-4 text-sm font-medium">
                        {auth.user ? (
                            <Link
                                href={dashboard()}
                                className="rounded-md bg-accent px-4 py-2 text-primary-foreground transition-colors hover:bg-accent/90 dark:bg-accent-alt dark:hover:bg-accent-alt/90"
                            >
                                Dashboard
                            </Link>
                        ) : (
                            <>
                                <Link
                                    href={login()}
                                    className="rounded-md px-4 py-2 transition-colors hover:bg-muted"
                                >
                                    Log in
                                </Link>
                                <Link
                                    href={register()}
                                    className="rounded-md bg-accent px-4 py-2 text-primary-foreground transition-colors hover:bg-accent/90 dark:bg-accent-alt dark:hover:bg-accent-alt/90"
                                >
                                    Register
                                </Link>
                            </>
                        )}
                    </div>
                </header>

                {/* Main Content */}
                <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
                    <p className="mb-2 text-xl font-medium tracking-wide md:text-5xl text-secondary-foreground">
                        Conversations That Happen in Real Time
                    </p>

                    <h1 className="mb-6 font-heading text-[6rem] leading-none text-accent dark:text-accent-alt md:text-[9rem]">
                        Syncora
                    </h1>

                    <p className="max-w-2xl text-base leading-relaxed text-muted-foreground md:text-lg">
                        Whether you're chatting with friends, collaborating with a team, or sharing ideas, enjoy a messaging experience that feels natural, responsive, and always in sync.
                    </p>
                </main>
            </div>
        </>
    );
}
