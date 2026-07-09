import AuthLayoutTemplate from '@/layouts/auth/auth-split-layout';
import { usePage } from '@inertiajs/react';

const pages = import.meta.glob('../pages/auth/*.tsx', { eager: true }) as Record<string, any>;

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { component } = usePage();
    const path = `../pages/${component}.tsx`;
    const pageModule = pages[path];
    const layoutProps = pageModule?.default?.layout || {};

    return (
        <AuthLayoutTemplate 
            title={layoutProps.title || ''} 
            description={layoutProps.description || ''} 
            image={layoutProps.image}
        >
            {children}
        </AuthLayoutTemplate>
    );
}
