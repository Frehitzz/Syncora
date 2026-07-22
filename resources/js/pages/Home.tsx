import { Head, Link, usePage } from '@inertiajs/react';
import { Moon, Sun, Search, MoreHorizontal, Info, Phone, Video, Bell, Edit } from 'lucide-react';
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
    id: number,
    sender: string,
    content: string,
    time: string,
    isOwn: boolean;
}

// --- Sub-Components ---

// ========== Avatar ===========
// Renders the user's avatar with initials, active status indicator dot, and size customization.
function Avatar({ initials, online = false, size = 'md' }: { initials: string; online?: boolean; size?: 'sm' | 'md' | 'lg' }) {
    const sizeClass = size === 'lg' ? 'w-10 h-10 text-sm' : size === 'sm' ? 'w-8 h-8 text-xs' : 'w-9 h-9 text-xs';

    return (
        <div className="relative flex-shrink-0">
            <div className={`${sizeClass} rounded-full bg-accent/20 dark:bg-accent-alt/20 flex items-center justify-center font-semibold text-accent dark:text-accent-alt font-sans`}>
                {initials}
            </div>
            {online && (
                <span className="absolute bottom-0 right-0 w-2.5 h-2.5 bg-green-500 rounded-full border-2 border-background" />
            )}
        </div>
    );
}

// ========== Conversation Item ===========
// Displays a conversation item preview in the sidebar (user details, last message, time, and unread badge).
function ConversationItem({ convo, active }: { convo: Conversation; active: boolean }) {
    return (
        <button
            className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-all duration-150 rounded-xl mx-1
                ${active
                    ? 'bg-accent/10 dark:bg-accent-alt/10'
                    : 'hover:bg-muted/60 dark:hover:bg-muted/20'
                }`}
        >
            <Avatar initials={convo.avatar} online={convo.online} />
            <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline">
                    <span className={`text-sm font-semibold truncate font-sans ${active ? 'text-accent dark:text-accent-alt' : 'text-foreground'}`}>
                        {convo.name}
                    </span>
                    <span className="text-xs text-muted-foreground flex-shrink-0 ml-2 font-sans">{convo.time}</span>
                </div>
                <div className="flex justify-between items-center mt-0.5">
                    <span className="text-xs text-muted-foreground truncate font-sans">{convo.lastMessage}</span>
                    {convo.unread > 0 && (
                        <span className="ml-2 flex-shrink-0 w-5 h-5 rounded-full bg-accent dark:bg-accent-alt text-white text-[10px] font-bold flex items-center justify-center font-sans">
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
        <div className={`flex items-end gap-2 ${message.isOwn ? 'flex-row-reverse' : 'flex-row'}`}>
            {!message.isOwn && (
                <Avatar initials="AN" size="sm" />
            )}
            <div className={`max-w-[60%] group`}>
                <div className={`px-4 py-2.5 rounded-2xl text-sm font-sans leading-relaxed
                    ${message.isOwn
                        ? 'bg-accent dark:bg-accent-alt text-white rounded-br-md'
                        : 'bg-muted dark:bg-muted/50 text-foreground rounded-bl-md'
                    }`}
                >
                    {message.content}
                </div>
                <p className={`text-[10px] text-muted-foreground mt-1 font-sans ${message.isOwn ? 'text-right' : 'text-left'}`}>
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
export default function Home({ conversations = [] }: { conversations?: Conversation[] }) {
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
    const [activeConvo, setActiveConvo] = useState<Conversation | null>(conversations[0] || null);

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
    const [userSearchResults, setUserSearchResults] = useState<UserSearchResult[]>([]);
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
                const response = await fetch(`/users/search?query=${encodeURIComponent(userSearchQuery)}`);

                // convert the backend response to json
                if (response.ok) {
                    const data = await response.json();
                    setUserSearchResults(data); // save the users we found so react can display them
                }
            } catch (error) {
                console.error("Failed to search users", error);
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
                console.error("Failed to fetch chat requests", error);
            }
        };

        fetchPendingRequests();
    }, []);

    // send a chat request to the selected user (instead of creating a conversation immediately)
    const startNewChat = async (userId: number) => {
        try {
            const response = await fetch('/chat-requests', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
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
            console.error("Failed to send chat request", error);
        }
    };

    // accept a chat request
    const acceptRequest = async (requestId: number) => {
        try {
            const response = await fetch(`/chat-requests/${requestId}/accept`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
            });

            if (response.ok) {
                // reload the page so the new conversation shows up in the sidebar
                window.location.reload();
            }
        } catch (error) {
            console.error("Failed to accept request", error);
        }
    };

    // reject a chat request
    const rejectRequest = async (requestId: number) => {
        try {
            const response = await fetch(`/chat-requests/${requestId}/reject`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                },
            });

            if (response.ok) {
                // remove the rejected request from our local state
                setChatRequests(prev => prev.filter(r => r.id !== requestId));
            }
        } catch (error) {
            console.error("Failed to reject request", error);
        }
    };

    // ======== FILTERED CONVERSATIONS ==========
    // filters the conversation list based on the search query (case-insensitive)
    // .filter() - a method that create an array and loops every conversation and check "does this one match the search"
    // .toLowerCase - transform all charaacter to lowercase
    // .includes() - checks if one string contains another ex. searched "ali" display "alice"
    const filteredConversations = conversations.filter((convo) =>
        convo.name.toLowerCase().includes(searchQuery.toLowerCase()));

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
            const response = await fetch(`/conversations/${activeConvo.id}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRF-TOKEN': document.querySelector<HTMLMetaElement>('meta[name="csrf-token"]')?.content || '',
                    'X-Socket-ID': window.Echo ? window.Echo.socketId() : '',
                },
                body: JSON.stringify({ body: newMessage }),
            });

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
            <div className="flex flex-col h-screen bg-background text-foreground overflow-hidden">

                {/* ── Header ── */}
                <header className="flex-shrink-0 flex items-center justify-between px-6 h-16 border-b border-border bg-background/80 backdrop-blur-md z-10">

                    {/* Left: Logo */}
                    <div className="flex-1 flex justify-start">
                        <Link href="/" className="font-heading text-4xl text-accent dark:text-accent-alt select-none">
                            SC
                        </Link>
                    </div>

                    {/* Center: Nav */}
                    <nav className="flex items-center gap-8 text-sm font-medium font-sans tracking-wide">
                        <Link
                            href="#"
                            className="relative text-accent dark:text-accent-alt font-semibold after:absolute after:-bottom-1 after:left-0 after:w-full after:h-0.5 after:rounded-full after:bg-accent dark:after:bg-accent-alt"
                        >
                            Home
                        </Link>
                        <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                            Profile
                        </Link>
                        <Link href="#" className="text-muted-foreground hover:text-foreground transition-colors">
                            Settings
                        </Link>
                    </nav>

                    {/* Right: Notifications & Theme Toggle */}
                    <div className="flex-1 flex justify-end items-center gap-1">
                        {/* Notification Bell */}
                        <div className="relative">
                            <button
                                onClick={() => setIsNotifOpen(!isNotifOpen)}
                                aria-label="Notifications"
                                className="relative w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all duration-150"
                            >
                                <Bell className="w-5 h-5" />
                                {/* Badge — shows the count of pending requests (only if there are any) */}
                                {chatRequests.length > 0 && (
                                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-bold font-sans leading-none">
                                        {chatRequests.length}
                                    </span>
                                )}
                            </button>

                            {/* Notification Dropdown — shows when you click the bell */}
                            {isNotifOpen && (
                                <div className="absolute right-0 top-full mt-2 w-80 bg-background border border-border rounded-2xl shadow-xl overflow-hidden z-50">
                                    <div className="px-4 py-3 border-b border-border">
                                        <h4 className="font-bold font-sans text-sm text-foreground">Chat Requests</h4>
                                    </div>
                                    <div className="max-h-64 overflow-y-auto">
                                        {chatRequests.length === 0 ? (
                                            <p className="text-center text-sm text-muted-foreground py-6 font-sans">
                                                No pending requests.
                                            </p>
                                        ) : (
                                            chatRequests.map(req => (
                                                <div
                                                    key={req.id}
                                                    className="flex items-center gap-3 px-4 py-3 border-b border-border last:border-b-0"
                                                >
                                                    {/* Sender avatar (first 2 letters of their name) */}
                                                    <div className="w-10 h-10 rounded-full bg-accent/20 text-accent dark:text-accent-alt flex items-center justify-center font-bold font-sans flex-shrink-0">
                                                        {req.sender.name.substring(0, 2).toUpperCase()}
                                                    </div>

                                                    {/* Sender info */}
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm font-bold font-sans text-foreground truncate">
                                                            {req.sender.name}
                                                        </p>
                                                        <p className="text-xs font-sans text-muted-foreground truncate">
                                                            wants to chat with you
                                                        </p>
                                                    </div>

                                                    {/* Accept & Reject buttons */}
                                                    <div className="flex gap-1.5 flex-shrink-0">
                                                        <button
                                                            onClick={() => acceptRequest(req.id)}
                                                            className="px-3 py-1.5 text-xs font-bold font-sans rounded-lg bg-accent dark:bg-accent-alt text-white hover:opacity-90 transition-opacity"
                                                        >
                                                            Accept
                                                        </button>
                                                        <button
                                                            onClick={() => rejectRequest(req.id)}
                                                            className="px-3 py-1.5 text-xs font-bold font-sans rounded-lg bg-muted text-muted-foreground hover:bg-red-500/20 hover:text-red-500 transition-colors"
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
                            className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all duration-150"
                        >
                            {resolvedAppearance === 'dark' ? (
                                <Sun className="w-5 h-5" />
                            ) : (
                                <Moon className="w-5 h-5" />
                            )}
                        </button>
                    </div>
                </header>

                {/* ── Body ── */}
                <div className="flex flex-1 overflow-hidden">

                    {/* ── Left Column (30%) — Conversation List ── */}
                    <aside className="w-[30%] flex-shrink-0 flex flex-col border-r border-border bg-background overflow-hidden">

                        {/* Left Top Bar */}
                        <div className="flex-shrink-0 flex items-center justify-between px-4 py-3 border-b border-border">
                            <h2 className="text-base font-bold font-sans text-foreground">Messages</h2>
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
                                    className={`w-8 h-8 rounded-full flex items-center justify-center transition-all
        ${searchOpen
                                            ? 'text-accent dark:text-accent-alt bg-accent/10 dark:bg-accent-alt/10'
                                            : 'text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40'
                                        }`}
                                >
                                    <Search className="w-4 h-4" />
                                </button>
                                {/* New Chat Button */}
                                <button
                                    onClick={() => setIsNewChatModalOpen(true)}
                                    aria-label="New chat"
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all"
                                >
                                    <Edit className="w-4 h-4" />
                                </button>
                                {/* More Options Button */}
                                <button
                                    aria-label="More options"
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all"
                                >
                                    <MoreHorizontal className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                        {/* Search Input Bar — slides in when search is active */}
                        {searchOpen && (
                            <div className="flex-shrink-0 px-4 py-2 border-b border-border">
                                <input
                                    type="text"
                                    placeholder="Search by name..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    autoFocus
                                    className="w-full px-3 py-2 text-sm font-sans rounded-lg bg-muted/50 dark:bg-muted/20 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-accent dark:focus:border-accent-alt focus:ring-1 focus:ring-accent/20 transition-all"
                                />
                            </div>
                        )}

                        {/* Conversation List 
                            - it display each convo on the left sidebar by the map().
                            - if user click each convo it will display the messaes of the convo by running selectConversation
                        */}
                        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
                            {filteredConversations.length > 0 ? (
                                filteredConversations.map((convo) => (
                                    <div key={convo.id} onClick={() => selectConversation(convo)}>
                                        <ConversationItem
                                            convo={{
                                                ...convo,
                                                online: convo.otherUserId !== null && onlineUserIds.has(convo.otherUserId),
                                            }}
                                            active={activeConvo !== null && convo.id === activeConvo.id}
                                        />
                                    </div>
                                ))
                            ) : (
                                <p className="text-center text-sm text-muted-foreground font-sans py-8">
                                    {searchOpen ? 'No conversations found.' : 'No conversations yet.'}
                                </p>
                            )}
                        </div>
                    </aside>

                    {/* ── Right Column (70%) — Chat Window ── */}
                    <main className="flex-1 flex flex-col overflow-hidden">

                        {/* Right Top Bar */}
                        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-background">
                            {/* Left: Active User Info */}
                            {activeConvo ? (
                                <div className="flex items-center gap-3">
                                    <Avatar
                                        initials={activeConvo.avatar}
                                        online={activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)}
                                        size="lg"
                                    />
                                    <div>
                                        <p className="text-sm font-bold font-sans text-foreground">{activeConvo.name}</p>
                                        {/* ── Typing indicator OR online status ── */}
                                        {typingUser ? (  /* ← ADD: show typing indicator if someone is typing */
                                            <p className="text-xs font-sans text-accent dark:text-accent-alt animate-pulse">
                                                {typingUser} is typing...
                                            </p>
                                        ) : (
                                            <p className={`text-xs font-sans ${activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)
                                                ? 'text-green-500'
                                                : 'text-muted-foreground'
                                                }`}>
                                                {activeConvo.otherUserId !== null && onlineUserIds.has(activeConvo.otherUserId)
                                                    ? 'Active now'
                                                    : 'Offline'}
                                            </p>
                                        )}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-sm text-muted-foreground font-sans">Select a conversation to start chatting</p>
                            )}

                            {/* Right: Action Buttons */}
                            <div className="flex items-center gap-1">
                                <button
                                    aria-label="Voice call"
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-accent dark:hover:text-accent-alt hover:bg-muted dark:hover:bg-muted/40 transition-all"
                                >
                                    <Phone className="w-4 h-4" />
                                </button>
                                <button
                                    aria-label="Video call"
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-accent dark:hover:text-accent-alt hover:bg-muted dark:hover:bg-muted/40 transition-all"
                                >
                                    <Video className="w-4 h-4" />
                                </button>
                                <button
                                    aria-label="Conversation info"
                                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:text-accent dark:hover:text-accent-alt hover:bg-muted dark:hover:bg-muted/40 transition-all"
                                >
                                    <Info className="w-4 h-4" />
                                </button>
                            </div>
                        </div>

                        {/* Messages Area */}
                        <div className="flex-1 overflow-y-auto px-6 py-6 space-y-4">
                            {activeConvo ? (
                                <>
                                    {/* Date Separator */}
                                    <div className="flex items-center gap-3 my-2">
                                        <div className="flex-1 h-px bg-border" />
                                        <span className="text-xs text-muted-foreground font-sans flex-shrink-0">Today</span>
                                        <div className="flex-1 h-px bg-border" />
                                    </div>

                                    {loadingMessages ? (
                                        <p className="text-center text-sm text-muted-foreground font-sans py-8">Loading messages...</p>
                                    ) : chatMessages.length > 0 ? (
                                        chatMessages.map((message) => (
                                            <MessageBubble key={message.id} message={message} />
                                        ))
                                    ) : (
                                        <p className="text-center text-sm text-muted-foreground font-sans py-8">No messages yet. Say hello! 👋</p>
                                    )}

                                    {/* Invisible div to scroll to */}
                                    <div ref={messagesEndRef} />
                                </>
                            ) : (
                                <div className="flex-1 flex items-center justify-center">
                                    <p className="text-sm text-muted-foreground font-sans">Select a conversation to view messages</p>
                                </div>
                            )}
                        </div>

                        {/* Message Input */}
                        {activeConvo && (
                            <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
                                <div className="flex items-center gap-3 bg-muted/50 dark:bg-muted/20 rounded-full px-5 py-3 border border-border transition-all focus-within:border-accent dark:focus-within:border-accent-alt focus-within:ring-1 focus-within:ring-accent/20">
                                    <input
                                        type="text"
                                        placeholder="Type a message..."
                                        value={newMessage}
                                        onChange={(e) => setNewMessage(e.target.value)}
                                        onKeyDown={(e) => {
                                            // ── Send the message when Enter is pressed ──
                                            if (e.key === 'Enter' && !e.shiftKey) {
                                                e.preventDefault();
                                                sendMessage();
                                                return; // ← ADD: stop here so we don't send a whisper for the Enter key
                                            }

                                            // ── Broadcast a "typing" whisper to the other user ──
                                            // This only fires for non-Enter keys (actual typing)
                                            // The whisper travels: our browser → Reverb → other user's browser
                                            // It NEVER touches the Laravel backend or database
                                            if (activeConvo) {
                                                window.Echo.private(`conversation.${activeConvo.id}`)
                                                    .whisper('typing', {
                                                        name: auth.user?.name ?? 'Someone', // who is typing
                                                    });
                                            }
                                        }}
                                        className="flex-1 bg-transparent text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none"
                                    />
                                    <button
                                        onClick={sendMessage}
                                        disabled={newMessage.trim() === ''}
                                        className="flex-shrink-0 w-8 h-8 rounded-full bg-accent dark:bg-accent-alt flex items-center justify-center text-white hover:opacity-90 transition-opacity disabled:opacity-40"
                                        aria-label="Send message"
                                    >
                                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
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
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-background border border-border w-full max-w-md rounded-2xl shadow-xl overflow-hidden flex flex-col max-h-[80vh]">

                        {/* Modal Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
                            <h3 className="font-bold font-sans text-foreground">Start New Chat</h3>
                            <button
                                onClick={() => {
                                    setIsNewChatModalOpen(false);
                                    setUserSearchQuery('');
                                    setUserSearchResults([]);
                                }}
                                className="text-muted-foreground hover:text-foreground text-sm font-sans"
                            >
                                Close
                            </button>
                        </div>

                        {/* Modal Body - Search Input */}
                        <div className="p-4 border-b border-border">
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
                                className="w-full px-4 py-2.5 text-sm font-sans rounded-xl bg-muted/50 dark:bg-muted/20 border border-border text-foreground placeholder:text-muted-foreground outline-none focus:border-accent dark:focus:border-accent-alt focus:ring-1 focus:ring-accent/20 transition-all"
                            />
                        </div>

                        {/* Modal Body - Search Results */}
                        <div className="flex-1 overflow-y-auto p-2 scrollbar-thin">
                            {isSearchingUsers ? (
                                <p className="text-center text-sm text-muted-foreground py-8 font-sans">Searching...</p>
                            ) : userSearchResults.length > 0 ? (
                                userSearchResults.map(user => (
                                    <button
                                        key={user.id}
                                        onClick={() => startNewChat(user.id)}
                                        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/60 dark:hover:bg-muted/20 rounded-xl transition-colors"
                                    >
                                        <div className="w-10 h-10 rounded-full bg-accent/20 text-accent dark:text-accent-alt flex items-center justify-center font-bold font-sans flex-shrink-0">
                                            {user.name.substring(0, 2).toUpperCase()}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold font-sans text-foreground truncate">{user.name}</p>
                                            <p className="text-xs font-sans text-muted-foreground truncate">{user.email}</p>
                                        </div>
                                    </button>
                                ))
                            ) : userSearchQuery !== '' ? (
                                <p className="text-center text-sm text-muted-foreground py-8 font-sans">No users found.</p>
                            ) : (
                                <p className="text-center text-sm text-muted-foreground py-8 font-sans">Type a name to search.</p>
                            )}
                        </div>

                    </div>
                </div>
            )}
        </>
    );
}
