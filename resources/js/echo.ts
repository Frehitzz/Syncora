import Echo from 'laravel-echo';
import Pusher from 'pusher-js';

if (typeof window !== 'undefined') {
    // Make Pusher available globally — Echo needs this to create the WebSocket connection
    window.Pusher = Pusher;

    // create new echo instance with the reverd config
    // this reads VITE_REVERB* on your .env file
    window.Echo = new Echo({
        broadcaster: 'reverb',
        key: import.meta.env.VITE_REVERB_APP_KEY,
        wsHost: import.meta.env.VITE_REVERB_HOST,
        wsPort: import.meta.env.VITE_REVERB_PORT ?? 443,
        forceTLS: (import.meta.env.VITE_REVERB_SCHEME ?? 'https') === 'https',
        enabledTransports: ['ws', 'wss'],
        authorizer: (channel: any) => {
            return {
                authorize: (
                    socketId: string,
                    callback: (error: any, data?: any) => void,
                ) => {
                    // Extract the encrypted CSRF token from the cookie
                    const match = document.cookie.match(
                        new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'),
                    );
                    const csrfToken = match ? decodeURIComponent(match[3]) : '';

                    fetch('/broadcasting/auth', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            Accept: 'application/json',
                            'X-XSRF-TOKEN': csrfToken,
                        },
                        body: JSON.stringify({
                            socket_id: socketId,
                            channel_name: channel.name,
                        }),
                    })
                        .then((response) => {
                            if (response.ok) {
                                return response.json();
                            }

                            throw new Error('Could not authenticate');
                        })
                        .then((data) => callback(false, data))
                        .catch((error) => callback(true, error));
                },
            };
        },
    });
}
