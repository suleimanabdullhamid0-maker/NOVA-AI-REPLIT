import { useMemo, useState } from 'react';
import { useLocation } from 'wouter';
import { FileText, Globe2, Image as ImageIcon, Paperclip, Plus, Send, Sparkles } from 'lucide-react';
import { getListMessagesQueryKey, useCreateConversation, useGenerateImage, useListConversations, useListMessages, useResearch, useSendMessage } from '@workspace/api-client-react';
import type { Conversation, Message, MessageInputMode } from '@workspace/api-client-react';
import { NovaShell } from '@/components/nova-shell';

type ChatMode = MessageInputMode | 'image';
type ChatUser = { name?: string | null; email: string; role?: string; plan?: string; usage?: number; usageLimit?: number };

const modes: { id: ChatMode; label: string; icon: typeof Sparkles; hint: string }[] = [
  { id: 'chat', label: 'Chat', icon: Sparkles, hint: 'A quick, thoughtful answer' },
  { id: 'research', label: 'Research', icon: Globe2, hint: 'Sources you can follow' },
  { id: 'document', label: 'Document', icon: FileText, hint: 'Work through a file' },
  { id: 'image', label: 'Image', icon: ImageIcon, hint: 'Make a visual direction' },
];

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en', { hour: 'numeric', minute: '2-digit' }).format(date);
}

function ConversationSkeleton() {
  return <div className="space-y-3 px-2">{[1, 2, 3, 4].map((item) => <div key={item} className="nova-skeleton h-11 rounded-xl" />)}</div>;
}

function ModePicker({ mode, setMode }: { mode: ChatMode; setMode: (mode: ChatMode) => void }) {
  return <div className="flex max-w-full gap-1 overflow-x-auto rounded-2xl border border-border bg-card p-1.5" data-testid="mode-switcher">{modes.map((item) => { const Icon = item.icon; const selected = mode === item.id; return <button key={item.id} type="button" onClick={() => setMode(item.id)} className={`flex shrink-0 items-center gap-2 rounded-xl px-3 py-2 text-xs font-semibold ${selected ? 'bg-primary text-primary-foreground shadow-sm' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} data-testid={`button-mode-${item.id}`}><Icon size={14} />{item.label}</button>; })}</div>;
}

function EmptyConversation({ onPrompt }: { onPrompt: (value: string) => void }) {
  const prompts = ['Turn my notes into a clear plan', 'What changed in the world this week?', 'Help me pressure-test an idea'];
  return <div className="flex flex-1 flex-col items-center justify-center px-5 py-12 text-center">
    <div className="relative mb-8 grid size-20 place-items-center rounded-[26px] border border-border bg-card shadow-sm"><div className="absolute inset-2 rounded-[19px] border border-accent/35" /><Sparkles size={25} className="text-accent-foreground" /></div>
    <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-muted-foreground">NOVA / ready when you are</p>
    <h1 className="mt-4 max-w-[570px] font-[var(--app-font-serif)] text-[clamp(2.3rem,4.7vw,4.6rem)] font-medium leading-[.96] tracking-[-.075em]">What are we<br /><span className="text-muted-foreground">thinking through?</span></h1>
    <p className="mt-5 max-w-[440px] text-sm leading-6 text-muted-foreground">Ask a question, bring a file, or start with a loose thread. NOVA will help you find the shape of it.</p>
    <div className="mt-9 flex flex-wrap justify-center gap-2">{prompts.map((prompt, index) => <button key={prompt} type="button" onClick={() => onPrompt(prompt)} className="rounded-full border border-border bg-card px-3.5 py-2 text-xs text-muted-foreground hover:-translate-y-0.5 hover:border-accent hover:text-foreground" data-testid={`button-suggested-prompt-${index}`}>{prompt}</button>)}</div>
  </div>;
}

function MessageBubble({ message }: { message: Message }) {
  const assistant = message.role === 'assistant';
  return <article className={`nova-rise flex gap-3.5 ${assistant ? '' : 'justify-end'}`} data-testid={`message-${message.id}`}>
    {assistant && <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-accent text-accent-foreground"><Sparkles size={13} /></div>}
    <div className={`max-w-[min(680px,88%)] ${assistant ? '' : 'order-first'}`}>
      <div className={`rounded-2xl px-4 py-3.5 text-sm leading-6 ${assistant ? 'rounded-tl-md border border-border bg-card' : 'rounded-tr-md bg-primary text-primary-foreground'}`} data-testid={`text-message-content-${message.id}`}>{message.content}</div>
      <div className={`mt-1.5 flex items-center gap-2 px-1 font-mono text-[9px] text-muted-foreground ${assistant ? '' : 'justify-end'}`}>{formatTime(message.createdAt)}{message.citations && message.citations.length > 0 && <span className="text-accent-foreground">{message.citations.length} sources</span>}</div>
    </div>
    {!assistant && <div className="mt-1 grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-[10px] font-bold">{message.role === 'user' ? 'YO' : 'SY'}</div>}
  </article>;
}

function RightRail({ mode, research, image }: { mode: ChatMode; research?: { status?: string; answer?: string; sources?: string[] }; image?: { status?: string; message?: string; url?: string | null } }) {
  return <aside className="hidden w-[285px] shrink-0 border-l border-border/75 bg-muted/35 px-5 py-7 xl:block">
    <div className="flex items-center justify-between"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Session context</p><span className="size-1.5 rounded-full bg-accent" /></div>
    <div className="mt-6 rounded-2xl border border-border bg-card p-4"><p className="text-xs font-semibold">Mode</p><div className="mt-2 flex items-center gap-2 text-sm"><span className="grid size-7 place-items-center rounded-lg bg-accent/25 text-accent-foreground">{mode === 'research' ? <Globe2 size={14} /> : mode === 'image' ? <ImageIcon size={14} /> : mode === 'document' ? <FileText size={14} /> : <Sparkles size={14} />}</span>{modes.find((item) => item.id === mode)?.label}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{modes.find((item) => item.id === mode)?.hint}</p></div>
    {research && <div className="mt-4 rounded-2xl border border-border bg-card p-4 nova-rise"><div className="flex items-center gap-2 text-xs font-semibold"><Globe2 size={14} className="text-accent-foreground" /> Research brief</div><p className="mt-3 text-xs leading-5 text-muted-foreground">{research.status === 'configuration_required' ? 'Research is waiting for a search provider to be connected.' : research.answer}</p>{research.sources?.length ? <div className="mt-3 space-y-1.5">{research.sources.slice(0, 3).map((source) => <p key={source} className="truncate font-mono text-[10px] text-accent-foreground">{source}</p>)}</div> : null}</div>}
    {image && <div className="mt-4 overflow-hidden rounded-2xl border border-border bg-card nova-rise"><div className="p-4"><div className="flex items-center gap-2 text-xs font-semibold"><ImageIcon size={14} className="text-accent-foreground" /> Image direction</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{image.message}</p></div>{image.url && <img src={image.url} alt="Generated direction" className="aspect-square w-full object-cover" data-testid="img-generated-result" />}</div>}
    <div className="mt-8"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Shortcuts</p><div className="mt-3 space-y-2 text-xs text-muted-foreground"><p><span className="mr-2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">⌘ K</span>Search conversations</p><p><span className="mr-2 rounded border border-border px-1.5 py-0.5 font-mono text-[10px]">⌘ ↵</span>Send message</p></div></div>
  </aside>;
}

export function ChatPage({ user }: { user?: ChatUser }) {
  const [, setLocation] = useLocation();
  const conversationsQuery = useListConversations();
  const conversations = conversationsQuery.data ?? [];
  const [activeId, setActiveId] = useState('');
  const [mode, setMode] = useState<ChatMode>('chat');
  const [draft, setDraft] = useState('');
  const [localMessages, setLocalMessages] = useState<Message[]>([]);
  const [research, setResearch] = useState<{ status?: string; answer?: string; sources?: string[] }>();
  const [image, setImage] = useState<{ status?: string; message?: string; url?: string | null }>();
  const messagesQuery = useListMessages(activeId || '', { query: { enabled: Boolean(activeId), queryKey: getListMessagesQueryKey(activeId || '') } });
  const createConversation = useCreateConversation();
  const sendMessage = useSendMessage();
  const researchMutation = useResearch();
  const imageMutation = useGenerateImage();
  const activeConversation = useMemo(() => conversations.find((item: Conversation) => item.id === activeId), [conversations, activeId]);
  const serverMessages = activeId ? (messagesQuery.data ?? []) : [];
  const messages = [...serverMessages, ...localMessages.filter((message) => !serverMessages.some((item) => item.id === message.id))];

  const openConversation = (conversation: Conversation) => { setActiveId(conversation.id); setLocalMessages([]); setResearch(undefined); setImage(undefined); };
  const startNew = () => { setActiveId(''); setLocalMessages([]); setResearch(undefined); setImage(undefined); setDraft(''); };
  const send = (preset?: string) => {
    const content = (preset ?? draft).trim();
    if (!content || sendMessage.isPending || createConversation.isPending) return;
    setDraft('');
    const sendTo = (id: string) => {
      if (mode === 'research') {
        researchMutation.mutate({ data: { query: content } }, { onSuccess: (result) => setResearch(result), onError: () => setResearch({ status: 'error', answer: 'Research could not be completed. Please try again.' }) });
      } else if (mode === 'image') {
        imageMutation.mutate({ data: { prompt: content } }, { onSuccess: (result) => setImage(result), onError: () => setImage({ message: 'Image generation could not be completed. Please try again.' }) });
      }
      sendMessage.mutate({ id, data: { content, mode: mode === 'image' ? 'chat' : mode } }, { onSuccess: (message) => setLocalMessages((items) => [...items, message]) });
    };
    if (activeId) sendTo(activeId);
    else createConversation.mutate({ data: { title: content.slice(0, 48) } }, { onSuccess: (conversation) => { setActiveId(conversation.id); sendTo(conversation.id); }, onError: () => setDraft(content) });
  };

  return <NovaShell user={user}>
    <div className="flex h-[calc(100dvh-72px)] min-h-[610px] overflow-hidden">
      <aside className="hidden w-[245px] shrink-0 border-r border-border/75 bg-background/55 px-4 py-6 lg:flex lg:flex-col">
        <div className="mb-5 flex items-center justify-between px-2"><p className="font-mono text-[10px] uppercase tracking-[0.2em] text-muted-foreground">Conversations</p><button onClick={startNew} className="rounded-lg p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="New conversation" data-testid="button-new-conversation-list"><Plus size={15} /></button></div>
        {conversationsQuery.isLoading ? <ConversationSkeleton /> : conversationsQuery.isError ? <div className="px-2 text-xs leading-5 text-destructive" data-testid="status-conversations-error">Unable to load conversations. <button onClick={() => conversationsQuery.refetch()} className="underline" data-testid="button-retry-conversations">Retry</button></div> : conversations.length === 0 ? <div className="rounded-xl border border-dashed border-border px-3 py-4 text-xs leading-5 text-muted-foreground" data-testid="empty-conversations">Your conversations will appear here.</div> : <div className="space-y-1 overflow-y-auto">{conversations.map((conversation) => <button key={conversation.id} onClick={() => openConversation(conversation)} className={`w-full rounded-xl px-3 py-2.5 text-left ${conversation.id === activeId ? 'bg-accent/20' : 'hover:bg-muted'}`} data-testid={`button-conversation-${conversation.id}`}><p className="truncate text-xs font-semibold">{conversation.title}</p><p className="mt-1 font-mono text-[9px] text-muted-foreground">{conversation.messageCount} {conversation.messageCount === 1 ? 'message' : 'messages'}</p></button>)}</div>}
        <div className="mt-auto rounded-xl border border-border bg-card p-3"><p className="text-xs font-semibold">Keep the thread moving.</p><p className="mt-1.5 text-[11px] leading-5 text-muted-foreground">Switch modes any time without losing your context.</p></div>
      </aside>
      <section className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between border-b border-border/75 px-5 py-4 md:px-8"><div className="min-w-0">{activeConversation ? <><p className="truncate text-sm font-semibold">{activeConversation.title}</p><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Conversation / {activeConversation.messageCount + localMessages.length} messages</p></> : <><p className="text-sm font-semibold">New conversation</p><p className="font-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Private workspace</p></>}</div><div className="flex items-center gap-2"><button onClick={startNew} className="rounded-xl border border-border px-3 py-2 text-xs font-semibold hover:bg-muted" data-testid="button-reset-chat">New thread</button></div></div>
        {messagesQuery.isError ? <div className="m-6 rounded-2xl border border-destructive/25 bg-destructive/8 p-4 text-sm text-destructive" data-testid="status-messages-error">This conversation could not be loaded. <button onClick={() => messagesQuery.refetch()} className="ml-1 underline" data-testid="button-retry-messages">Try again</button></div> : messagesQuery.isLoading ? <div className="flex-1 space-y-4 px-5 py-8 md:px-16"><div className="nova-skeleton h-20 max-w-[500px] rounded-2xl" /><div className="nova-skeleton ml-auto h-14 max-w-[340px] rounded-2xl" /><div className="nova-skeleton h-28 max-w-[560px] rounded-2xl" /></div> : messages.length === 0 ? <EmptyConversation onPrompt={(prompt) => send(prompt)} /> : <div className="flex-1 space-y-6 overflow-y-auto px-5 py-8 md:px-[clamp(24px,7vw,110px)]">{messages.map((message) => <MessageBubble key={message.id} message={message} />)}{(sendMessage.isPending || researchMutation.isPending || imageMutation.isPending) && <div className="flex items-center gap-3 text-xs text-muted-foreground"><span className="grid size-7 place-items-center rounded-lg bg-accent/25"><span className="nova-dot size-1.5 rounded-full bg-accent-foreground" /></span>{researchMutation.isPending ? 'Following the thread across sources…' : imageMutation.isPending ? 'Finding the visual direction…' : 'NOVA is thinking…'}</div>}</div>}
        <div className="border-t border-border/75 bg-background/90 px-4 py-4 md:px-8 md:py-5"><div className="mx-auto max-w-[850px]"><ModePicker mode={mode} setMode={setMode} /><div className="mt-3 rounded-2xl border border-border bg-card p-2 shadow-sm focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/15"><textarea value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if ((event.metaKey || event.ctrlKey) && event.key === 'Enter') send(); }} rows={2} className="max-h-32 min-h-[54px] w-full resize-none bg-transparent px-3 py-2 text-sm leading-6 outline-none placeholder:text-muted-foreground" placeholder={mode === 'research' ? 'What should we investigate?' : mode === 'image' ? 'Describe the image you want to see…' : mode === 'document' ? 'Ask about a document you have in mind…' : 'Ask NOVA anything…'} data-testid="input-message" /><div className="flex items-center justify-between px-2 pb-1"><div className="flex items-center gap-1"><button type="button" onClick={() => setMode('document')} className={`rounded-lg p-2 ${mode === 'document' ? 'bg-accent/25 text-accent-foreground' : 'text-muted-foreground hover:bg-muted hover:text-foreground'}`} aria-label="Use document mode" data-testid="button-attach-document"><Paperclip size={15} /></button><span className="hidden text-[10px] text-muted-foreground sm:inline">Document mode is ready for your next file</span></div><button type="button" onClick={() => send()} disabled={!draft.trim() || sendMessage.isPending || researchMutation.isPending || imageMutation.isPending} className="flex items-center gap-2 rounded-xl bg-primary px-3.5 py-2 text-xs font-semibold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-35" data-testid="button-send-message">Send <Send size={13} /></button></div></div><p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">NOVA can make mistakes · verify important details</p></div></div>
      </section>
      <RightRail mode={mode} research={research} image={image} />
    </div>
  </NovaShell>;
}