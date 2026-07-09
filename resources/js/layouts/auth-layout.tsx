import * as React from 'react';
import AuthLayoutTemplate from '@/layouts/auth/auth-split-layout';

function findLayoutProps(element: any): any {
    if (!element || typeof element !== 'object') {
return {};
}
    
    if (element.type?.layout) {
        return element.type.layout;
    }

    if (element.type?.type?.layout) {
        return element.type.type.layout;
    }
    
    if (element.props?.children) {
        if (Array.isArray(element.props.children)) {
            for (const child of element.props.children) {
                const props = findLayoutProps(child);

                if (Object.keys(props).length > 0) {
return props;
}
            }
        } else {
            return findLayoutProps(element.props.children);
        }
    }
    
    return {};
}

export default function AuthLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const layoutProps = findLayoutProps(children);

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
