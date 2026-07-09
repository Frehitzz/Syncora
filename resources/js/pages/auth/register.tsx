import { Form, Head } from '@inertiajs/react';
import InputError from '@/components/input-error';
import PasswordInput from '@/components/password-input';
import TextLink from '@/components/text-link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Spinner } from '@/components/ui/spinner';
import { login } from '@/routes';
import { store } from '@/routes/register';

type Props = {
    passwordRules: string;
};

export default function Register({ passwordRules }: Props) {
    return (
        <>
            <Head title="Register" />
            <Form
                {...store.form()}
                resetOnSuccess={['password', 'password_confirmation']}
                disableWhileProcessing
                className="flex flex-col gap-6"
            >
                {({ processing, errors }) => (
                    <>
                        <div className="grid gap-6">
                            <div className="grid gap-2">
                                <Label htmlFor="name" className="font-sans text-foreground/80">Name</Label>
                                <Input
                                    id="name"
                                    type="text"
                                    required
                                    autoFocus
                                    tabIndex={1}
                                    autoComplete="name"
                                    name="name"
                                    placeholder="Full name"
                                    className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/80 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all hover:bg-white/80 dark:hover:bg-white/20 focus-visible:bg-white/90 dark:focus-visible:bg-white/30"
                                />
                                <InputError
                                    message={errors.name}
                                    className="mt-2"
                                />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="email" className="font-sans text-foreground/80">Email address</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    required
                                    tabIndex={2}
                                    autoComplete="email"
                                    name="email"
                                    placeholder="email@example.com"
                                    className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/80 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all hover:bg-white/80 dark:hover:bg-white/20 focus-visible:bg-white/90 dark:focus-visible:bg-white/30"
                                />
                                <InputError message={errors.email} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password" className="font-sans text-foreground/80">Password</Label>
                                <PasswordInput
                                    id="password"
                                    required
                                    tabIndex={3}
                                    autoComplete="new-password"
                                    name="password"
                                    placeholder="Password"
                                    passwordrules={passwordRules}
                                    className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/80 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all hover:bg-white/80 dark:hover:bg-white/20 focus-visible:bg-white/90 dark:focus-visible:bg-white/30"
                                />
                                <InputError message={errors.password} />
                            </div>

                            <div className="grid gap-2">
                                <Label htmlFor="password_confirmation" className="font-sans text-foreground/80">
                                    Confirm password
                                </Label>
                                <PasswordInput
                                    id="password_confirmation"
                                    required
                                    tabIndex={4}
                                    autoComplete="new-password"
                                    name="password_confirmation"
                                    placeholder="Confirm password"
                                    passwordrules={passwordRules}
                                    className="bg-white/60 dark:bg-white/10 backdrop-blur-md border border-white/80 dark:border-white/20 shadow-[0_4px_16px_rgba(0,0,0,0.05)] transition-all hover:bg-white/80 dark:hover:bg-white/20 focus-visible:bg-white/90 dark:focus-visible:bg-white/30"
                                />
                                <InputError
                                    message={errors.password_confirmation}
                                />
                            </div>

                            <Button
                                type="submit"
                                className="mt-4 w-full bg-accent-alt text-accent-foreground font-sans font-semibold tracking-wide hover:opacity-90 transition-opacity"
                                tabIndex={5}
                                data-test="register-user-button"
                            >
                                {processing && <Spinner />}
                                Create account
                            </Button>
                        </div>

                        <div className="text-center text-sm text-muted-foreground font-sans">
                            Already have an account?{' '}
                            <TextLink href={login()} className="text-primary hover:text-accent-alt transition-colors font-medium" tabIndex={6}>
                                Log in
                            </TextLink>
                        </div>
                    </>
                )}
            </Form>
        </>
    );
}

Register.layout = {
    title: 'Create an account',
    description: 'Enter your details below to create your account',
    image: '/images/register-image.png',
};
