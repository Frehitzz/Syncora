import { Head, Link, usePage } from '@inertiajs/react';
import {
    Moon,
    Sun,
    Search,
    MoreHorizontal,
    Info,
    Phone,
    Video,
    Bell,
    Edit,
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAppearance } from '@/hooks/use-appearance';

// ========== STRICT CONTRACT BLUEPRINT FOR THE DATA THAT LARAVEL WILL SEND =======
// we telling react what the conversation data will looks like:
// "we have an id that is a number , a name that is string etc"
interface Conversation {
    id: number;
    otherUserId: number | null;
    name: string;
    lastMessage: string;
    time: string;
    avatar: string;
    unread: number;
    online: boolean;
}

interface Message {
    id: number;
    sender: string;
    content: string;
    time: string;
    isOwn: boolean;
}

// --- Sub-Components ---

// ========== Avatar ===========
// Renders the user's avatar with initials, active status indicator dot, and size customization.
function Avatar({
    initials,
    online = false,
    size = 'md',
}: {
    initials: string;
    online?: boolean;
    size?: 'sm' | 'md' | 'lg';
}) {
    const sizeClass =
        size === 'lg'
            ? 'w-10 h-10 text-sm'
            : size === 'sm'
              ? 'w-8 h-8 text-xs'
              : 'w-9 h-9 text-xs';

    return (
        <div className="relative flex-shrink-0">
            <div
                className={`${sizeClass} flex items-center justify-center rounded-full bg-accent/20 font-sans font-semibold text-accent dark:bg-accent-alt/20 dark:text-accent-alt`}
            >
                {initials}
            </div>
            {online && (
                <span className="absolute right-0 bottom-0 h-2.5 w-2.5 rounded-full border-2 border-background bg-green-500" />
            )}
        </div>
    );
}

// ========== Conversation Item ===========
// Displays a conversation item preview in the sidebar (user details, last message, time, and unread badge).
function ConversationItem({
    convo,
    active,
}: {
    convo: Conversation;
    active: boolean;
}) {
    return (
        <button
            className={`mx-1 flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-all duration-150 ${
                active
                    ? 'bg-accent/10 dark:bg-accent-alt/10'
                    : 'hover:bg-muted/60 dark:hover:bg-muted/20'
            }`}
        >
            <Avatar initials={convo.avatar} online={convo.online} />
            <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between">
                    <span
                        className={`truncate font-sans text-sm font-semibold ${active ? 'text-accent dark:text-accent-alt' : 'text-foreground'}`}
                    >
                        {convo.name}
                    </span>
                    <span className="ml-2 flex-shrink-0 font-sans text-xs text-muted-foreground">
                        {convo.time}
                    </span>
                </div>
                <div className="mt-0.5 flex items-center justify-between">
                    <span className="truncate font-sans text-xs text-muted-foreground">
                        {convo.lastMessage}
                    </span>
                    {convo.unread > 0 && (
                        <span className="ml-2 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full bg-accent font-sans text-[10px] font-bold text-white dark:bg-accent-alt">
                            {convo.unread}
                        </span>
                    )}
                </div>
            </div>
        </button>
    );
}

// ========== Message Bubble ===========
// Displays a single chat message bubble, aligned on the right if it's sent by you, or left if sent by others.
function MessageBubble({ message }: { message: Message }) {
    return (
        <div
            className={`flex items-end gap-2 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'}`}
        >
            {!message.isOwn && <Avatar initials="AN" size="sm" />}
            <div className={`group max-w-[60%]`}>
                <div
                    className={`rounded-2xl px-4 py-2.5 font-sans text-sm leading-relaxed ${
                        message.isOwn
                            ? 'rounded-br-md bg-accent text-white dark:bg-accent-alt'
                            : 'rounded-bl-md bg-muted text-foreground dark:bg-muted/50'
                    }`}
                >
                    {message.content}
                </div>
                <p
                    className={`mt-1 font-sans text-[10px] text-muted-foreground ${message.isOwn ? 'text-right' : 'text-left'}`}
                >
                    {message.time}
                </p>
            </div>
        </div>
    );
}

// --- Main Messages Component ---
interface UserSearchResult {
    id: number;
    name: string;
    email: string;
}

interface ChatRequestData {
    id: number;
    sender_id: number;
    receiver_id: number;
    status: string;
    sender: {
        id: number;
        name: string;
        email: string;
    };
}

// ========== Home ===========
// The main page component representing the home dashboard containing the Facebook-like UI (header, sidebar, chat window).
export default function Home({
    conversations = [],
}: {
    conversations?: Conversation[];
}) {
    const { resolvedAppearance, updateAppearance } = useAppearance();

    // ====== CURRENT USER DATA =====
    // get authenticated users data from inertia shared page props
    const { auth } = usePage().props;

    const toggleTheme = () => {
        updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark');
    };

    //useState<Conversation | null>(conversations[0] || null) -  the default will be the first conversation if theres no vonversation fallback to null
    // activeConvo creates a memory slot that make react to remember what convo is selected
    // setActiveConvo is the function you call tho change it
    const [activeConvo, setActiveConvo] = useState<Conversation | null>(
        conversations[0] || null,
    );

    // useState<Message[]>([]) - start as an empty array bc we havent loadded any messages yet
    const [chatMessages, setChatMessages] = useState<Message[]>([]);

    // tracks whether messages are currently being loaded from the sesrver
    const [loadingMessages, setLoadingMessages] = useState(false);

    // tracks what the user is typing
    const [newMessage, setNewMessage] = useState('');

    // track if search bar is visible
    const [searchOpen, setSearchOpen] = useState(false);

    // tracks the search query text
    const [searchQuery, setSearchQuery] = useState('');

    // ======== AUTO-SCROLL TO BOTTOM ==========
    const messagesEndRef = useRef<HTMLDivElement>(null);
    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    };

    // ======== TYPING INDICATOR TIMER =======
    // holds the setTimeout Id so we can clear it when a new keystroke arrives
    // userRef (not useState) because changing a timer ID should NOT cause a re-render
    const typingTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Trigger auto-scroll whenever chat messages change
    useEffect(() => {
        scrollToBottom();
    }, [chatMessages]);

    // ======== NEW CHAT MODAL STATE ==========
    const [isNewChatModalOpen, setIsNewChatModalOpen] = useState(false);
    const [userSearchQuery, setUserSearchQuery] = useState('');
    const [userSearchResults, setUserSearchResults] = useState<
        UserSearchResult[]
    >([]);
    const [isSearchingUsers, setIsSearchingUsers] = useState(false);

    // ======== CHAT REQUEST NOTIFICATION STATE ==========
    const [chatRequests, setChatRequests] = useState<ChatRequestData[]>([]);
    const [isNotifOpen, setIsNotifOpen] = useState(false);

    // ======== ONLINE USERS STATE ==========
    // Tracks which user IDs are currently online via presence channel
    // This is a Set because we only need to check "is this user online?" (fast lookups)
    const [onlineUserIds, setOnlineUserIds] = useState<Set<number>>(new Set());

    // ======== TYPING INDICATOR STATE ========
    // tracks the name of the user who is currently typing in the active conversation
    // null means nobody is typing (hide the indicator)
    const [typingUser, setTypingUser] = useState<string | null>(null);

    // every time you type it automatically display the users realtime
    useEffect(() => {
        if (userSearchQuery.trim() === '') {
            return;
        }

        // define search function
        const searchUsers = async () => {
            setIsSearchingUsers(true);

            // turn on loading spinner
            try {
                // go to the backend route
                const response = await fetch(
                    `/users/search?query=${encodeURIComponent(userSearchQuery)}`,
                );

                // convert the backend response to json
                if (response.ok) {
                    const data = await response.json();
                    setUserSearchResults(data); // save the users we found so react can display them
                }
            } catch (error) {
                console.error('Failed to search users', error);
            } finally {
                // turn off the loading spinner
                setIsSearchingUsers(false);
            }
        };

        // to let user finish the typing before display results
        const delayTimer = setTimeout(searchUsers, 300);

        return () => clearTimeout(delayTimer);
    }, [userSearchQuery]);

    // load pending chat requests when the page first loads
    useEffect(() => {
        const fetchPendingRequests = async () => {
            try {
                const response = await fetch('/chat-requests/pending');

                if (response.ok) {
                    const data = await response.json();
                    setChatRequests(data);
                }
            } catch (error) {
                console.error('Failed to fetch chat requests', error);
            }
        };

        fetchPendingRequests();
    }, []);

    // send a chat request to the selected user (instead of creating a conversation immediately)
    const startNewChat = async (userId: number) => {
        try {
            const getCsrfToken = () => {
                const match = document.cookie.match(
                    new RegExp('(^|;\\s*)(XSRF-TOKEN)=([^;]*)'),
                );

                return match ? decodeURIComponent(match[3]) : '';
            };

            const response = await fetch('/chat-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-XSRF-TOKEN': getCsrfToken(),
                },
                body: JSON.stringify({ receiver_id: userId }),
            });

            if (response.ok) {
                setIsNewChatModalOpen(false);
                setUserSearchQuery('');
                setUserSearchResults([]);
                alert('Chat request sent!');
            } else {
                // if the backend returned an error (like duplicate request), show it
                const errorData = await response.json();
                alert(errorData.message || 'Failed to send chat request.');
            }
        } catch (error) {
            console.error('Failed to send chat request', error);
        }
    };

    // accept a chat request
    const acceptRequest = async (requestId: number) => {
        try {
            const response = await fetch(`/chat-requests/${requestId}/accept`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content || '',
                },
            });

            if (response.ok) {
                // reload the page so the new conversation shows up in the sidebar
                window.location.reload();
            }
        } catch (error) {
            console.error('Failed to accept request', error);
        }
    };

    // reject a chat request
    const rejectRequest = async (requestId: number) => {
        try {
            const response = await fetch(`/chat-requests/${requestId}/reject`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN':
                        document.querySelector<HTMLMetaElement>(
                            'meta[name="csrf-token"]',
                        )?.content || '',
                },
            });

            if (response.ok) {
                // remove the rejected request from our local state
                setChatRequests((prev) =>
                    prev.filter((r) => r.id !== requestId),
                );
            }
        } catch (error) {
            console.error('Failed to reject request', error);
        }
    };

    // ======== FILTERED CONVERSATIONS ==========
    // filters the conversation list based on the search query (case-insensitive)
    // .filter() - a method that create an array and loops every conversation and check "does this one match the search"
    // .toLowerCase - transform all charaacter to lowercase
    // .includes() - checks if one string contains another ex. searched "ali" display "alice"
    const filteredConversations = conversations.filter((convo) =>
        convo.name.toLowerCase().includes(searchQuery.toLowerCase()),
    );

    // ========  SELECT CONVERSATION ==========
    // when the conversation is clicked, set it as an active and fetch its message from backend
    const selectConversation = async (convo: Conversation) => {
        setActiveConvo(convo); // highlights the conversation you clicked on the leftsidebar
        setLoadingMessages(true); // turns on the loading indicator
        // deletes the messages from the previous convo you were looking, so you dont see them while the new ones are loading
        setChatMessages([]);

        try {
            // fetch - reach out to laravel backend, it called ajax requestsm it req to our new route
            const response = await fetch(`/conversations/${convo.id}/messages`);
            // take the raw json and transform it into js array/object that react can understand
            const data = await response.json();
            // takes that fresh translated data and saves it into react memory
            setChatMessages(data);
        } catch (error) {
            console.error('Failed to fetch messages:', error);
        } finally {
            setLoadingMessages(false);
        }
    };

    // ========= SEND MESSAGE ==========
    // sends the typed message to the backend, saves itm and
    // shows it in the chat window
    const sendMessage = async () => {
        // don't send if there's no active conversation or the message is empty
        if (!activeConvo || newMessage.trim() === '') {
            return;
        }

        try {
            const response = await fetch(
                `/conversations/${activeConvo.id}/messages`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-CSRF-TOKEN':
                            document.querySelector<HTMLMetaElement>(
                                'meta[name="csrf-token"]',
                            )?.content || '',
                        'X-Socket-ID': window.Echo
                            ? window.Echo.socketId()
                            : '',
                    },
                    body: JSON.stringify({ body: newMessage }),
                },
            );

            if (!response.ok) {
                throw new Error('Failed to send message');
            }

            // the backend returns the saved message in the format we need
            const savedMessage = await response.json();

            // add the new message to the end of the chat list
            setChatMessages((prev) => [...prev, savedMessage]);

            // clear the input box so the user can type a new message
            setNewMessage('');
        } catch (error) {
            console.error('Failed to send message:', error);
        }
    };

    // ========== REAL-TIME MESSAGE LISTENER ==========
    // Whenever the active conversation changes, we subscribe to its WebSocket channel.
    // When a new MessageSent event arrives, we add the message to the chat.
    useEffect(() => {
        // Don't set up a listener if there's no active conversation
        if (!activeConvo) {
            return;
        }

        // Subscribe to the private channel for this conversation
        // "private" means the user must be authorized (checked in channels.php)
        window.Echo.private(`conversation.${activeConvo.id}`)
            .listen('MessageSent', (data: Message) => {
                // "data" contains everything we returned in broadcastWith()

                setChatMessages((prev) => {
                    // PREVENT DUPLICATES: React StrictMode (during development)
                    // sometimes registers the WebSocket listener twice.
                    // This ensures we never add the same message ID twice!
                    const isDuplicate = prev.some((msg) => msg.id === data.id);

                    if (isDuplicate) {
                        return prev;
                    }

                    // Add the incoming message to the end of the chat list
                    return [...prev, data];
                });
            })
            // ==== LISTEN FOR TYPING WHISPER EVENT =====
            .listenForWhisper('typing', (data: { name: string }) => {
                // show typing indicator with the sender's name
                setTypingUser(data.name);

                // clear any existing timer - this is the reset button
                if (typingTimeoutRef.current) {
                    clearTimeout(typingTimeoutRef.current);
                }

                typingTimeoutRef.current = setTimeout(() => {
                    setTypingUser(null); // hide the indicator
                }, 2000);
            });

        // CLEANUP FUNCTION:
        // When the user clicks a different conversation (activeConvo changes),
        // React will run this cleanup function FIRST to unsubscribe from the old channel.
        return () => {
            window.Echo.leave(`conversation.${activeConvo.id}`);

            // Also clear any pending typing timer to prevent state updates on unmounted components
            if (typingTimeoutRef.current) {
                clearTimeout(typingTimeoutRef.current);
            }

            setTypingUser(null); // reset typing indicator when switching conversations
        };
    }, [activeConvo]); // Re-run this effect every time activeConvo changes

    // ========== PRESENCE CHANNEL — ONLINE STATUS ==========
    // Join the presence channel once when the component mounts.
    // This tracks who is currently connected to the app.
    useEffect(() => {
        // Join the presence channel — Echo adds the "presence-" prefix automatically
        const channel = window.Echo.join('chat')
            // Called ONCE when we first connect — gives us everyone already online
            .here((users: { id: number; name: string }[]) => {
                // Build a Set from the array of user objects
                setOnlineUserIds(new Set(users.map((u) => u.id)));
            })
            // Called every time a NEW user comes online after us
            .joining((user: { id: number; name: string }) => {
                setOnlineUserIds((prev) => {
                    const next = new Set(prev); // clone the Set (React needs a new reference to re-render)
                    next.add(user.id);

                    return next;
                });
            })
            // Called every time a user goes offline (closes tab, disconnects)
            .leaving((user: { id: number; name: string }) => {
                setOnlineUserIds((prev) => {
                    const next = new Set(prev); // clone
                    next.delete(user.id);

                    return next;
                });
            });

        // CLEANUP: when the component unmounts (user navigates away), leave the channel
        return () => {
            channel.leave();
        };
    }, []); // Empty array = run once on mount, clean up on unmount

    // auto display messages for the first conversation when the page loads
    useEffect(() => {
        if (conversations.length > 0) {
            // eslint-disable-next-line react-hooks/set-state-in-effect
            selectConversation(conversations[0]);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []); // [] - to run this code exactly one time after the message appears

    return (
        <>
            <Head title="Messages — Syncora" />
            <div className="flex h-screen flex-col overflow-hidden bg-background text-foreground">
                {/* ── Header ── */}
                <header className="z-10 flex h-16 flex-shrink-0 items-center justify-between border-b border-border bg-background/80 px-6 backdrop-blur-md">
                    {/* Left: Logo */}
                    <div className="flex flex-1 justify-start">
                        <Link
                            href="/"
                            className="font-heading text-4xl text-accent select-none dark:text-accent-alt"
                        >
                            SC
                        </Link>
                    </div>

                    {/* Center: Nav */}
                    <nav className="flex items-center gap-8 font-sans text-sm font-medium tracking-wide">
                        <Link
                            href="#"
                            className="relative font-semibold text-accent after:absolute after:-bottom-1 after:left-0 after:h-0.5 after:w-full after:rounded-full after:bg-accent dark:text-accent-alt dark:after:bg-accent-alt"
                        >
                            Home
                        </Link>
                        <Link
                            href="#"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Profile
                        </Link>
                        <Link
                            href="#"
                            className="text-muted-foreground transition-colors hover:text-foreground"
                        >
                            Settings
                        </Link>
                    </nav>

                    {/* Right: Notifications & Theme Toggle */}
                    <div className="flex flex-1 items-center justify-end gap-1">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                aria-label="Notifications"
                                className="relative flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground dark:hover:bg-muted/40"
                            >
                                <Bell className="h-5 w-5" />
                                {/* Badge — shows the count of pending requests (only if there are any) */}
                                {chatRequests.length > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-red-500 px-1 font-sans text-[10px] leading-none font-bold text-white">
                                        {chatRequests.length}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown — shows when you click the bell */}
                            {isNotifOpen && (
                                <div className="absolute top-full right-0 z-50 mt-2 w-80 overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                                    <div className="border-b border-border px-4 py-3">
                                        <h4 className="font-sans text-sm font-bold text-foreground">
                                            Chat Requests
                                        </h4>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {chatRequests.length === 0 ? (
                                            <p className="py-6 text-center font-sans text-sm text-muted-foreground">
                                                No pending requests.
                                            </p>
                                        ) : (
                                            chatRequests.map((req) => (
                                                <div
                                                    key={req.id}
                                                    className="flex items-center gap-3 border-b border-border px-4 py-3 last:border-b-0"
                                                >
                                                    {/* Sender avatar (first 2 letters of their name) */}
                                                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 font-sans font-bold text-accent dark:text-accent-alt">
                                                        {req.sender.name
                                                            .substring(0, 2)
                                                            .toUpperCase()}
                                                    </div>

                                                    {/* Sender info */}
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate font-sans text-sm font-bold text-foreground">
                                                            {req.sender.name}
                                                        </p>
                                                        <p className="truncate font-sans text-xs text-muted-foreground">
                                                            wants to chat with
                                                            you
                                                        </p>
                                                    </div>

                                                    {/* Accept & Reject buttons */}
                                                    <div className="flex flex-shrink-0 gap-1.5">
                                                        <button
                                                            onClick={() =>
                                                                acceptRequest(
                                                                    req.id,
                                                                )
                                                            }
                                                            className="rounded-lg bg-accent px-3 py-1.5 font-sans text-xs font-bold text-white transition-opacity hover:opacity-90 dark:bg-accent-alt"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() =>
                                                                rejectRequest(
                                                                    req.id,
                                                                )
                                                            }
                                                            className="rounded-lg bg-muted px-3 py-1.5 font-sans text-xs font-bold text-muted-foreground transition-colors hover:bg-red-500/20 hover:text-red-500"
                                                        >
                                                            Reject
                                                        </button>
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        {/* Theme Toggle */}
                        <button
                            onClick={toggleTheme}
                            aria-label="Toggle dark mode"
                            className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all duration-150 hover:bg-muted hover:text-foreground dark:hover:bg-muted/40"
                        >
                            {resolvedAppearance === 'dark' ? (
                                <Sun className="h-5 w-5" />
                            ) : (
                                <Moon className="h-5 w-5" />
                            )}
                        </button>
                    </div>
                </header>

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">
                    {/* ── Left Column (30%) — Conversation List ── */}
                    <aside className="flex w-[30%] flex-shrink-0 flex-col overflow-hidden border-r border-border bg-background">
                        {/* Left Top Bar */}
                        <div className="flex flex-shrink-0 items-center justify-between border-b border-border px-4 py-3">
                            <h2 className="font-sans text-base font-bold text-foreground">
                                Messages
                            </h2>
                            <div className="flex items-center gap-2">
                                {/* Search Button */}
                                <button
                                    onClick={() => {
                                        setSearchOpen(!searchOpen);

                                        if (searchOpen) {
                                            setSearchQuery('');
                                        }
                                    }}
                                    aria-label="Search conversations"
                                    className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                                        searchOpen
                                            ? 'bg-accent/10 text-accent dark:bg-accent-alt/10 dark:text-accent-alt'
                                            : 'text-muted-foreground hover:bg-muted hover:text-foreground dark:hover:bg-muted/40'
                                    }`}
                                >
                                    <Search className="h-4 w-4" />
                                </button>
                                {/* New Chat Button */}
                                <button
                                    onClick={() => setIsNewChatModalOpen(true)}
                                    aria-label="New chat"
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground dark:hover:bg-muted/40"
                                >
                                    <Edit className="h-4 w-4" />
                                </button>
                                {/* More Options Button */}
                                <button
                                    aria-label="More options"
                                    className="flex h-8 w-8 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-foreground dark:hover:bg-muted/40"
                                >
                                    <MoreHorizontal className="h-4 w-4" />
                                </button>
                            </div>
                        </div>
                        {/* Search Input Bar — slides in when search is active */}
                        {searchOpen && (
                            <div className="flex-shrink-0 border-b border-border px-4 py-2">
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) =>
                                        setSearchQuery(e.target.value)
                                    }
                                    autoFocus
                                    className="w-full rounded-lg border border-border bg-muted/50 px-3 py-2 font-sans text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-1 focus:ring-accent/20 dark:bg-muted/20 dark:focus:border-accent-alt"
                                />
                            </div>
                        )}

                        {/* Conversation List 
                            - it display each convo on the left sidebar by the map().
                            - if user click each convo it will display the messaes of the convo by running selectConversation
                        */}
                        <div className="flex-1 scrollbar-thin space-y-0.5 overflow-y-auto py-2">
                            {filteredConversations.length > 0 ? (
                                filteredConversations.map((convo) => (
                                    <div
                                        key={convo.id}
                                        onClick={() =>
                                            selectConversation(convo)
                                        }
                                    >
                                        <ConversationItem
                                            convo={{
                                                ...convo,
                                                online:
                                                    convo.otherUserId !==
                                                        null &&
                                                    onlineUserIds.has(
                                                        convo.otherUserId,
                                                    ),
                                            }}
                                            active={
                                                activeConvo !== null &&
                                                convo.id === activeConvo.id
                                            }
                                        />
                                    </div>
                                ))
                            ) : (
                                <p className="py-8 text-center font-sans text-sm text-muted-foreground">
                                    {searchOpen
                                        ? 'No conversations found.'
                                        : 'No conversations yet.'}
                                </p>
                            )}
                        </div>
                    </aside>

                    {/* ── Right Column (70%) — Chat Window ── */}
                    <main className="flex flex-1 flex-col overflow-hidden">
                        {/* Right Top Bar */}
                        <div className="flex flex-shrink-0 items-center justify-between border-b border-border bg-background px-6 py-3">
                            {/* Left: Active User Info */}
                            {activeConvo ? (
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        initials={activeConvo.avatar}
                                        online={
                                            activeConvo.otherUserId !== null &&
                                            onlineUserIds.has(
                                                activeConvo.otherUserId,
                                            )
                                        }
                                        size="lg"
                                    />
                                    <div>
                                        <p className="font-sans text-sm font-bold text-foreground">
                                            {activeConvo.name}
                                        </p>
                                        {/* ── Typing indicator OR online status ── */}
                                        {typingUser /* ← ADD: show typing indicator if someone is typing */ ? (
                                            <p className="animate-pulse font-sans text-xs text-accent dark:text-accent-alt">
                                                {typingUser} is typing...
                                            </p>
                                        ) : (
                                            <p
                                                className={`font-sans text-xs ${
                                                    activeConvo.otherUserId !==
                                                        null &&
                                                    onlineUserIds.has(
                                                        activeConvo.otherUserId,
                                                    )
                                                        ? 'text-green-500'
                                                        : 'text-muted-foreground'
                                                }`}
                                            >
                                                {activeConvo.otherUserId !==
                                                    null &&
                                                onlineUserIds.has(
                                                    activeConvo.otherUserId,
                                                )
                                                    ? 'Active now'
                                                    : 'Offline'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="font-sans text-sm text-muted-foreground">
                                    Select a conversation to start chatting
                                </p>
                            )}

                            {/* Right: Action Buttons */}
                            <div className="flex items-center gap-1">
                                <button
                                    aria-label="Voice call"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-accent dark:hover:bg-muted/40 dark:hover:text-accent-alt"
                                >
                                    <Phone className="h-4 w-4" />
                                </button>
                                <button
                                    aria-label="Video call"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-accent dark:hover:bg-muted/40 dark:hover:text-accent-alt"
                                >
                                    <Video className="h-4 w-4" />
                                </button>
                                <button
                                    aria-label="Conversation info"
                                    className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-all hover:bg-muted hover:text-accent dark:hover:bg-muted/40 dark:hover:text-accent-alt"
                                >
                                    <Info className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 space-y-4 overflow-y-auto px-6 py-6">
                            {activeConvo ? (
                                <>
                                    {/* Date Separator */}
                                    <div className="my-2 flex items-center gap-3">
                                        <div className="h-px flex-1 bg-border" />
                                        <span className="flex-shrink-0 font-sans text-xs text-muted-foreground">
                                            Today
                                        </span>
                                        <div className="h-px flex-1 bg-border" />
                                    </div>

                                    {loadingMessages ? (
                                        <p className="py-8 text-center font-sans text-sm text-muted-foreground">
                                            Loading messages...
                                        </p>
                                    ) : chatMessages.length > 0 ? (
                                        chatMessages.map((message) => (
                                            <MessageBubble
                                                key={message.id}
                                                message={message}
                                            />
                                        ))
                                    ) : (
                                        <p className="py-8 text-center font-sans text-sm text-muted-foreground">
                                            No messages yet. Say hello! 👋
                                        </p>
                                    )}

                                    {/* Invisible div to scroll to */}
                                    <div ref={messagesEndRef} />
                                </>
                            ) : (
                                <div className="flex flex-1 items-center justify-center">
                                    <p className="font-sans text-sm text-muted-foreground">
                                        Select a conversation to view messages
                                    </p>
                                </div>
                            )}
                        </div>

                        {/* Message Input */}
                        {activeConvo && (
                            <div className="flex-shrink-0 border-t border-border bg-background px-6 py-4">
                                <div className="flex items-center gap-3 rounded-full border border-border bg-muted/50 px-5 py-3 transition-all focus-within:border-accent focus-within:ring-1 focus-within:ring-accent/20 dark:bg-muted/20 dark:focus-within:border-accent-alt">
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) =>
                                            setNewMessage(e.target.value)
                                        }
                                        onKeyDown={(e) => {
                                            // ── Send the message when Enter is pressed ──
                                            if (
                                                e.key === 'Enter' &&
                                                !e.shiftKey
                                            ) {
                                                e.preventDefault();
                                                sendMessage();

                                                return; // ← ADD: stop here so we don't send a whisper for the Enter key
                                            }

                                            // ── Broadcast a "typing" whisper to the other user ──
                                            // This only fires for non-Enter keys (actual typing)
                                            // The whisper travels: our browser → Reverb → other user's browser
                                            // It NEVER touches the Laravel backend or database
                                            if (activeConvo) {
                                                window.Echo.private(
                                                    `conversation.${activeConvo.id}`,
                                                ).whisper('typing', {
                                                    name:
                                                        auth.user?.name ??
                                                        'Someone', // who is typing
                                                });
                                            }
                                        }}
                                        className="flex-1 bg-transparent font-sans text-sm text-foreground outline-none placeholder:text-muted-foreground"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={newMessage.trim() === ''}
                                        className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-accent text-white transition-opacity hover:opacity-90 disabled:opacity-40 dark:bg-accent-alt"
                                        aria-label="Send message"
                                    >
                                        <svg
                                            xmlns="http://www.w3.org/2000/svg"
                                            viewBox="0 0 24 24"
                                            fill="currentColor"
                                            className="h-4 w-4"
                                        >
                                            <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                        </svg>
                                    </button>
                                </div>
                            </div>
                        )}
                    </main>
                </div>
            </div>

            {/* ── New Chat Modal Overlay ── */}
            {isNewChatModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
                    <div className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl border border-border bg-background shadow-xl">
                        {/* Modal Header */}
                        <div className="flex items-center justify-between border-b border-border px-6 py-4">
                            <h3 className="font-sans font-bold text-foreground">
                                Start New Chat
                            </h3>
                            <button
                                onClick={() => {
                                    setIsNewChatModalOpen(false);
                                    setUserSearchQuery('');
                                    setUserSearchResults([]);
                                }}
                                className="font-sans text-sm text-muted-foreground hover:text-foreground"
                            >
                                Close
                            </button>
                        </div>

                        {/* Modal Body - Search Input */}
                        <div className="border-b border-border p-4">
                            <input
                                type="text"
                                placeholder="Search by name or email..."
                                value={userSearchQuery}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    setUserSearchQuery(value);

                                    if (value.trim() === '') {
                                        setUserSearchResults([]);
                                    }
                                }}
                                autoFocus
                                className="w-full rounded-xl border border-border bg-muted/50 px-4 py-2.5 font-sans text-sm text-foreground transition-all outline-none placeholder:text-muted-foreground focus:border-accent focus:ring-1 focus:ring-accent/20 dark:bg-muted/20 dark:focus:border-accent-alt"
                            />
                        </div>

                        {/* Modal Body - Search Results */}
                        <div className="flex-1 scrollbar-thin overflow-y-auto p-2">
                            {isSearchingUsers ? (
                                <p className="py-8 text-center font-sans text-sm text-muted-foreground">
                                    Searching...
                                </p>
                            ) : userSearchResults.length > 0 ? (
                                userSearchResults.map((user) => (
                                    <button
                                        key={user.id}
                                        onClick={() => startNewChat(user.id)}
                                        className="flex w-full items-center gap-3 rounded-xl px-4 py-3 text-left transition-colors hover:bg-muted/60 dark:hover:bg-muted/20"
                                    >
                                        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-accent/20 font-sans font-bold text-accent dark:text-accent-alt">
                                            {user.name
                                                .substring(0, 2)
                                                .toUpperCase()}
                                        </div>
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-sans text-sm font-bold text-foreground">
                                                {user.name}
                                            </p>
                                            <p className="truncate font-sans text-xs text-muted-foreground">
                                                {user.email}
                                            </p>
                                        </div>
                                    </button>
                                ))
                            ) : userSearchQuery !== '' ? (
                                <p className="py-8 text-center font-sans text-sm text-muted-foreground">
                                    No users found.
                                </p>
                            ) : (
                                <p className="py-8 text-center font-sans text-sm text-muted-foreground">
                                    Type a name to search.
                                </p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
