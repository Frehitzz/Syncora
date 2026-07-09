import { Head, Link } from '@inertiajs/react';
import { Moon, Sun, Search, MoreHorizontal, Info, Phone, Video } from 'lucide-react';
import { useAppearance } from '@/hooks/use-appearance';

// --- Placeholder Data ---
const conversations = [
    { id: 1, name: 'Alice Nguyen', lastMessage: 'See you tomorrow!', time: '2m ago', avatar: 'AN', unread: 2, online: true },
    { id: 2, name: 'Bob Martinez', lastMessage: 'Can you send me the file?', time: '15m ago', avatar: 'BM', unread: 0, online: false },
    { id: 3, name: 'Carla Reyes', lastMessage: 'That sounds great 😊', time: '1h ago', avatar: 'CR', unread: 0, online: true },
    { id: 4, name: 'David Kim', lastMessage: 'On my way!', time: '3h ago', avatar: 'DK', unread: 5, online: false },
    { id: 5, name: 'Eva Chen', lastMessage: 'haha yes exactly!', time: 'Yesterday', avatar: 'EC', unread: 0, online: true },
    { id: 6, name: 'Frank Liu', lastMessage: 'Meeting at 3pm?', time: 'Yesterday', avatar: 'FL', unread: 0, online: false },
];

const messages = [
    { id: 1, sender: 'Alice Nguyen', content: 'Hey! Are you free this weekend?', time: '10:32 AM', isOwn: false },
    { id: 2, sender: 'You', content: "Yeah, I think so! What's up?", time: '10:34 AM', isOwn: true },
    { id: 3, sender: 'Alice Nguyen', content: 'We were thinking of going hiking. Want to join?', time: '10:35 AM', isOwn: false },
    { id: 4, sender: 'You', content: "That sounds awesome! Where are you planning to go?", time: '10:37 AM', isOwn: true },
    { id: 5, sender: 'Alice Nguyen', content: 'Probably Mt. Pulag. It\'s been on my list for a while now!', time: '10:38 AM', isOwn: false },
    { id: 6, sender: 'You', content: "I'm in! Let's sort out the details. 🏔️", time: '10:40 AM', isOwn: true },
    { id: 7, sender: 'Alice Nguyen', content: 'See you tomorrow!', time: '10:41 AM', isOwn: false },
];

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
function ConversationItem({ convo, active }: { convo: typeof conversations[0]; active: boolean }) {
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
function MessageBubble({ message }: { message: typeof messages[0] }) {
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

// ========== Home ===========
// The main page component representing the home dashboard containing the Facebook-like UI (header, sidebar, chat window).
export default function Home() {
    const { resolvedAppearance, updateAppearance } = useAppearance();

    const toggleTheme = () => {
        updateAppearance(resolvedAppearance === 'dark' ? 'light' : 'dark');
    };

    const activeConvo = conversations[0];

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

                    {/* Right: Theme Toggle */}
                    <div className="flex-1 flex justify-end">
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
                                    aria-label="Search conversations"
                                    className="w-8 h-8 rounded-full flex items-center justify-center text-muted-foreground hover:text-foreground hover:bg-muted dark:hover:bg-muted/40 transition-all"
                                >
                                    <Search className="w-4 h-4" />
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

                        {/* Conversation List */}
                        <div className="flex-1 overflow-y-auto py-2 space-y-0.5 scrollbar-thin">
                            {conversations.map((convo) => (
                                <ConversationItem
                                    key={convo.id}
                                    convo={convo}
                                    active={convo.id === activeConvo.id}
                                />
                            ))}
                        </div>
                    </aside>

                    {/* ── Right Column (70%) — Chat Window ── */}
                    <main className="flex-1 flex flex-col overflow-hidden">

                        {/* Right Top Bar */}
                        <div className="flex-shrink-0 flex items-center justify-between px-6 py-3 border-b border-border bg-background">
                            {/* Left: Active User Info */}
                            <div className="flex items-center gap-3">
                                <Avatar initials={activeConvo.avatar} online={activeConvo.online} size="lg" />
                                <div>
                                    <p className="text-sm font-bold font-sans text-foreground">{activeConvo.name}</p>
                                    <p className="text-xs font-sans text-green-500">
                                        {activeConvo.online ? 'Active now' : 'Offline'}
                                    </p>
                                </div>
                            </div>

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
                            {/* Date Separator */}
                            <div className="flex items-center gap-3 my-2">
                                <div className="flex-1 h-px bg-border" />
                                <span className="text-xs text-muted-foreground font-sans flex-shrink-0">Today</span>
                                <div className="flex-1 h-px bg-border" />
                            </div>

                            {messages.map((message) => (
                                <MessageBubble key={message.id} message={message} />
                            ))}
                        </div>

                        {/* Message Input */}
                        <div className="flex-shrink-0 px-6 py-4 border-t border-border bg-background">
                            <div className="flex items-center gap-3 bg-muted/50 dark:bg-muted/20 rounded-full px-5 py-3 border border-border transition-all focus-within:border-accent dark:focus-within:border-accent-alt focus-within:ring-1 focus-within:ring-accent/20">
                                <input
                                    type="text"
                                    placeholder="Type a message..."
                                    className="flex-1 bg-transparent text-sm font-sans text-foreground placeholder:text-muted-foreground outline-none"
                                />
                                <button
                                    className="flex-shrink-0 w-8 h-8 rounded-full bg-accent dark:bg-accent-alt flex items-center justify-center text-white hover:opacity-90 transition-opacity"
                                    aria-label="Send message"
                                >
                                    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
                                        <path d="M3.478 2.405a.75.75 0 00-.926.94l2.432 7.905H13.5a.75.75 0 010 1.5H4.984l-2.432 7.905a.75.75 0 00.926.94 60.519 60.519 0 0018.445-8.986.75.75 0 000-1.218A60.517 60.517 0 003.478 2.405z" />
                                    </svg>
                                </button>
                            </div>
                        </div>
                    </main>

                </div>
            </div>
        </>
    );
}
