import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';

import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { register } from '@/routes';
import { store } from '@/routes/login';
import { request } from '@/routes/password';

type Props = {
    status?: string;
    canResetPassword: boolean;
};

export default function Login({ status, canResetPassword }: Props) {
    return (
        <>
            <Head title="Log in" />



            <Form
                {...store.form()}
                resetOnSuccess={['password']}
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="email" className="font-sans text-foreground/80">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    name="email"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="email"
                                    placeholder="email@example.com"
                                    className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/80 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all hover:bg-white/80 dark:hover:bg-white/20 focus-visible:bg-white/90 dark:focus-visible:bg-white/30"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <div className="flex items-center">
                                    <Label htmlFor="password" className="font-sans text-foreground/80">Password</Label>
                                    {canResetPassword && (
                                        <TextLink
                                            href={request()}
                                            className="ml-auto text-sm text-primary hover:text-accent-alt transition-colors"
                                            tabIndex={5}
                                        >
                                            Forgot your password?
                                        </TextLink>
                                    )}
                                </div>
                                <PasswordInput
                                    id="password"
                                    name="password"
                                    required
                                    tabIndex={2}
                                    autoComplete="current-password"
                                    placeholder="Password"
                                    className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/80 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all hover:bg-white/80 dark:hover:bg-white/20 focus-visible:bg-white/90 dark:focus-visible:bg-white/30"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="flex items-center space-x-3">
                                <Checkbox
                                    id="remember"
                                    name="remember"
                                    tabIndex={3}
                                />
                                <Label htmlFor="remember" className="font-sans text-foreground/80">Remember me</Label>
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full bg-accent-alt text-accent-foreground font-sans font-semibold tracking-wide hover:opacity-90 transition-opacity"
                                tabIndex={4}
                                disabled={processing}
                                data-test="login-button"
                            >
                                {processing && <Spinner />}
                                Log in
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground font-sans">
                            Don't have an account?{' '}
                            <TextLink href={register()} className="text-primary hover:text-accent-alt transition-colors font-medium" tabIndex={5}>
                                Sign up
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>

            {status && (
                <div className="mb-4 text-center text-sm font-medium text-green-600">
                    {status}
                </div>
            )}
        </>
    );
}

Login.layout = {
    title: 'Log in to your account',
    description: 'Enter your email and password below to log in',
    image: '/images/login-image.png',
};
