import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";
import { Button, LoadingSpinner, Modal } from "../components";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { chatApi, ChatProviderError } from "../services/chat";
import type { ChatConversation, ChatMessage } from "../types/chat";
import styles from "./ChatPage.module.css";

const maxQuestionLength = 1200;
const suggestions = [
  {
    icon: "spending",
    question: "How much did I spend this month?",
  },
  {
    icon: "category",
    question: "Which category did I spend the most on?",
  },
  {
    icon: "compare",
    question: "How does my spending compare with last month?",
  },
  {
    icon: "budget",
    question: "Am I staying within my budgets?",
  },
  {
    icon: "goals",
    question: "How close am I to my savings goals?",
  },
  {
    icon: "net",
    question: "What was my net position this month?",
  },
];

function formatTimestamp(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

function uniqueMessages(messages: ChatMessage[]) {
  const seen = new Set<number>();
  return messages.filter((message) => {
    if (seen.has(message.id)) {
      return false;
    }
    seen.add(message.id);
    return true;
  });
}

function ArrowDownIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
      <path d="M10.2 4.2 2.8 18a2 2 0 0 0 1.8 3h14.8a2 2 0 0 0 1.8-3L13.8 4.2a2 2 0 0 0-3.6 0Z" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="m5 12 4 4L19 6" />
    </svg>
  );
}

function ClockIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 8v5l3 2" />
    </svg>
  );
}

function CopyIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <rect x="8" y="8" width="10" height="10" rx="2" />
      <path d="M6 16H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z" />
    </svg>
  );
}

function RetryIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M20 12a8 8 0 1 1-2.34-5.66" />
      <path d="M20 4v6h-6" />
    </svg>
  );
}

function XIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" focusable="false">
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </svg>
  );
}

function renderInlineMarkdown(line: string) {
  const renderInline = (line: string) => {
    const parts: ReactNode[] = [];
    let lastIndex = 0;
    const pattern = /\*\*(.+?)\*\*/g;
    for (const match of line.matchAll(pattern)) {
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }
      parts.push(
        <strong key={`${match.index}-${match[1].slice(0, 12)}`}>
          {match[1]}
        </strong>,
      );
      lastIndex = match.index + match[0].length;
    }
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }
    return parts.length ? parts : line;
  };

  return renderInline(line);
}

function renderMarkdown(content: string) {
  const blocks: ReactNode[] = [];
  const lines = content.replace(/\r\n/g, "\n").split("\n");
  let index = 0;

  while (index < lines.length) {
    const line = lines[index].trim();
    if (!line) {
      index += 1;
      continue;
    }

    const heading = /^(#{1,3})\s+(.+)$/.exec(line);
    if (heading) {
      const HeadingTag = `h${Math.min(heading[1].length + 2, 5)}` as
        | "h3"
        | "h4"
        | "h5";
      blocks.push(
        <HeadingTag key={`heading-${index}`}>
          {renderInlineMarkdown(heading[2])}
        </HeadingTag>,
      );
      index += 1;
      continue;
    }

    const unorderedItems: ReactNode[] = [];
    while (index < lines.length) {
      const match = /^\s*[-*]\s+(.+)$/.exec(lines[index]);
      if (!match) break;
      unorderedItems.push(
        <li key={`ul-${index}`}>{renderInlineMarkdown(match[1])}</li>,
      );
      index += 1;
    }
    if (unorderedItems.length) {
      blocks.push(<ul key={`ul-${index}`}>{unorderedItems}</ul>);
      continue;
    }

    const orderedItems: ReactNode[] = [];
    while (index < lines.length) {
      const match = /^\s*\d+[.)]\s+(.+)$/.exec(lines[index]);
      if (!match) break;
      orderedItems.push(
        <li key={`ol-${index}`}>{renderInlineMarkdown(match[1])}</li>,
      );
      index += 1;
    }
    if (orderedItems.length) {
      blocks.push(<ol key={`ol-${index}`}>{orderedItems}</ol>);
      continue;
    }

    const paragraphLines = [line];
    index += 1;
    while (index < lines.length) {
      const next = lines[index].trim();
      if (
        !next ||
        /^#{1,3}\s+/.test(next) ||
        /^\s*[-*]\s+/.test(lines[index]) ||
        /^\s*\d+[.)]\s+/.test(lines[index])
      ) {
        break;
      }
      paragraphLines.push(next);
      index += 1;
    }
    blocks.push(
      <p key={`p-${index}`}>
        {renderInlineMarkdown(paragraphLines.join(" "))}
      </p>,
    );
  }

  return blocks;
}

function upsertConversation(
  conversations: ChatConversation[],
  next: ChatConversation,
) {
  const filtered = conversations.filter((item) => item.id !== next.id);
  return [next, ...filtered].sort((a, b) => {
    const aTime = new Date(a.last_message_at ?? a.updated_at).getTime();
    const bTime = new Date(b.last_message_at ?? b.updated_at).getTime();
    return bTime - aTime;
  });
}

function MessageBubble({
  message,
  onRetry,
  isRetrying,
  onCopy,
  isCopied,
}: {
  message: ChatMessage;
  onRetry: (message: ChatMessage) => void;
  isRetrying: boolean;
  onCopy: (message: ChatMessage) => void;
  isCopied: boolean;
}) {
  const isUser = message.role === "user";
  const hasAssistantFailure = message.status === "assistant_failed";
  return (
    <article
      className={`${styles.messageRow} ${
        isUser ? styles.messageUser : styles.messageAssistant
      }`}
    >
      <div className={styles.bubble}>
        {isUser ? (
          <p>{message.content}</p>
        ) : (
          renderMarkdown(message.content)
        )}
      </div>
      <div className={styles.messageMeta}>
        <time className={styles.messageTime}>
          {formatTimestamp(message.created_at)}
        </time>
        {!isUser ? (
          <button
            aria-label={isCopied ? "Copied response" : "Copy response"}
            className={styles.messageAction}
            onClick={() => onCopy(message)}
            title={isCopied ? "Copied" : "Copy response"}
            type="button"
          >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
          </button>
        ) : null}
      </div>
      {hasAssistantFailure ? (
        <div className={styles.inlineError} role="status">
          <AlertIcon />
          <span>MoneyMate AI could not answer that. Please retry in a moment.</span>
          <Button
            className={styles.retryButton}
            disabled={isRetrying}
            onClick={() => onRetry(message)}
            variant="secondary"
          >
            <RetryIcon />
            <span>{isRetrying ? "Retrying..." : "Retry"}</span>
          </Button>
        </div>
      ) : null}
    </article>
  );
}

function PlusIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function SendIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M4 12 20 4l-5 16-3-7-8-1Z" />
      <path d="m12 13 8-9" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M5 7h14M10 11v6M14 11v6M8 7l1-3h6l1 3M7 7l1 13h8l1-13" />
    </svg>
  );
}

function AssistantMark() {
  return (
    <img
      alt=""
      aria-hidden="true"
      className={styles.headerLogo}
      src="/moneymate-ai-assistant.png"
    />
  );
}

function SuggestionIcon({ type }: { type: string }) {
  if (type === "spending") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M7 7h10a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3H7a3 3 0 0 1-3-3V7a3 3 0 0 1 3-3h8" />
        <path d="M16 13h4" />
        <circle cx="16" cy="13" r="1" />
        <path d="M9 9h4" />
      </svg>
    );
  }

  if (type === "category") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 6h16M4 12h10M4 18h7" />
        <path d="m16 15 2 2 4-5" />
      </svg>
    );
  }

  if (type === "compare") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M4 17 9 12l4 4 7-8" />
        <path d="M15 8h5v5" />
      </svg>
    );
  }

  if (type === "budget") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M12 12V4a8 8 0 1 1-8 8h8Z" />
        <path d="M15 3v6h6A6 6 0 0 0 15 3Z" />
      </svg>
    );
  }

  if (type === "goals") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="11" cy="13" r="7" />
        <circle cx="11" cy="13" r="3" />
        <path d="m13 11 7-7M17 4h3v3" />
      </svg>
    );
  }

  if (type === "net") {
    return (
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <path d="M5 19V5" />
        <path d="M5 19h14" />
        <path d="M8 16V9M12 16V7M16 16v-4" />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24">
      <path d="M6 7h12M6 12h12M6 17h8" />
      <path d="M17 16c0 2-2 4-5 4s-5-2-5-4" />
    </svg>
  );
}

function TypingIndicator() {
  return (
    <div className={`${styles.messageRow} ${styles.messageAssistant}`}>
      <div className={styles.bubble} aria-live="polite">
        <span className={styles.typing}>
          <span />
          <span />
          <span />
        </span>
      </div>
    </div>
  );
}

type ChatPageProps = {
  mode?: "page" | "widget";
  onClose?: () => void;
};

export function ChatPage({ mode = "page", onClose }: ChatPageProps) {
  const { user } = useAuth();
  const [conversations, setConversations] = useState<ChatConversation[]>([]);
  const [activeConversation, setActiveConversation] =
    useState<ChatConversation | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [draft, setDraft] = useState("");
  const [conversationError, setConversationError] = useState("");
  const [messageError, setMessageError] = useState("");
  const [isLoadingConversations, setIsLoadingConversations] = useState(true);
  const [isLoadingMessages, setIsLoadingMessages] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [retryingId, setRetryingId] = useState<number | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [clearCandidate, setClearCandidate] =
    useState<ChatConversation | null>(null);
  const [renamingId, setRenamingId] = useState<number | null>(null);
  const [renameDraft, setRenameDraft] = useState("");
  const [savingRenameId, setSavingRenameId] = useState<number | null>(null);
  const [copiedId, setCopiedId] = useState<number | null>(null);
  const [isHistoryOpen, setIsHistoryOpen] = useState(mode === "page");
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBeforeMessageId, setNextBeforeMessageId] = useState<number | null>(
    null,
  );
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const questionInputRef = useRef<HTMLTextAreaElement | null>(null);
  const shouldStickToBottom = useRef(true);

  const validationMessage = useMemo(() => {
    if (draft.length > maxQuestionLength) {
      return `Questions are limited to ${maxQuestionLength} characters.`;
    }
    return "";
  }, [draft]);
  const firstName = user?.full_name?.split(/\s+/)[0] || "there";

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      const node = messagesRef.current;
      if (node) {
        node.scrollTop = node.scrollHeight;
      }
    });
  }, []);

  const resizeQuestionInput = useCallback(() => {
    const input = questionInputRef.current;
    if (!input) {
      return;
    }
    input.style.height = "auto";
    const maxHeight = 144;
    input.style.height = `${Math.min(input.scrollHeight, maxHeight)}px`;
    input.style.overflowY =
      input.scrollHeight > maxHeight ? "auto" : "hidden";
  }, []);

  const loadConversations = useCallback(async () => {
    setIsLoadingConversations(true);
    setConversationError("");
    try {
      const response = await chatApi.conversations();
      setConversations(response.items);
      setActiveConversation((current) => current ?? response.items[0] ?? null);
    } catch (error) {
      setConversationError(getApiErrorMessage(error));
    } finally {
      setIsLoadingConversations(false);
    }
  }, []);

  const loadMessages = useCallback(
    async (conversationId: number) => {
      setIsLoadingMessages(true);
      setMessageError("");
      try {
        const response = await chatApi.messages(conversationId);
        setMessages(response.items);
        setHasMoreMessages(response.has_more);
        setNextBeforeMessageId(response.next_before_message_id ?? null);
        shouldStickToBottom.current = true;
        scrollToBottom();
      } catch (error) {
        setMessageError(getApiErrorMessage(error));
      } finally {
        setIsLoadingMessages(false);
      }
    },
    [scrollToBottom],
  );

  useEffect(() => {
    void loadConversations();
  }, [loadConversations]);

  useEffect(() => {
    if (activeConversation && !isSending) {
      void loadMessages(activeConversation.id);
    } else if (!activeConversation && !isSending) {
      setMessages([]);
      setHasMoreMessages(false);
      setNextBeforeMessageId(null);
    }
  }, [activeConversation, isSending, loadMessages]);

  useEffect(() => {
    if (shouldStickToBottom.current) {
      scrollToBottom();
    } else if (messages.length) {
      setShowJumpLatest(true);
    }
  }, [isSending, messages, scrollToBottom]);

  useEffect(() => {
    resizeQuestionInput();
  }, [draft, resizeQuestionInput]);

  const handleScroll = () => {
    const node = messagesRef.current;
    if (!node) {
      return;
    }
    const distance = node.scrollHeight - node.scrollTop - node.clientHeight;
    shouldStickToBottom.current = distance < 96;
    setShowJumpLatest(distance >= 120);
  };

  const loadOlderMessages = async () => {
    if (!activeConversation || !nextBeforeMessageId) {
      return;
    }
    const node = messagesRef.current;
    const previousHeight = node?.scrollHeight ?? 0;
    const response = await chatApi.messages(
      activeConversation.id,
      30,
      nextBeforeMessageId,
    );
    setMessages((current) =>
      uniqueMessages([...response.items, ...current]),
    );
    setHasMoreMessages(response.has_more);
    setNextBeforeMessageId(response.next_before_message_id ?? null);
    requestAnimationFrame(() => {
      if (node) {
        node.scrollTop = node.scrollHeight - previousHeight;
      }
    });
  };

  const ensureConversation = async () => {
    if (activeConversation) {
      return activeConversation;
    }
    const conversation = await chatApi.createConversation();
    setConversations((current) => upsertConversation(current, conversation));
    setActiveConversation(conversation);
    return conversation;
  };

  const applySendResponse = (response: Awaited<ReturnType<typeof chatApi.sendMessage>>) => {
    setActiveConversation(response.conversation);
    setConversations((current) =>
      upsertConversation(current, response.conversation),
    );
    setMessages((current) =>
      uniqueMessages([
        ...current.filter(
          (message) => message.id > 0,
        ),
        response.user_message,
        response.assistant_message,
      ]),
    );
    shouldStickToBottom.current = true;
  };

  const handleProviderFailure = (error: ChatProviderError) => {
    setActiveConversation(error.failure.conversation);
    setConversations((current) =>
      upsertConversation(current, error.failure.conversation),
    );
    setMessages((current) =>
      uniqueMessages([
        ...current.filter(
          (message) => message.id > 0,
        ),
        error.failure.user_message,
      ]),
    );
  };

  const sendQuestion = async (question: string) => {
    const normalized = question.trim();
    if (!normalized || normalized.length > maxQuestionLength || isSending) {
      return;
    }
    setIsSending(true);
    setMessageError("");
    const tempMessage: ChatMessage = {
      id: -Date.now(),
      conversation_id: activeConversation?.id ?? -1,
      role: "user",
      content: normalized,
      created_at: new Date().toISOString(),
      sources: [],
      metrics: {},
      status: "complete",
    };
    setMessages((current) => [...current, tempMessage]);
    setDraft("");
    shouldStickToBottom.current = true;
    try {
      const conversation = await ensureConversation();
      const response = await chatApi.sendMessage(conversation.id, normalized);
      applySendResponse(response);
    } catch (error) {
      if (error instanceof ChatProviderError) {
        handleProviderFailure(error);
      } else {
        setMessages((current) =>
          current.filter((message) => message.id !== tempMessage.id),
        );
        setDraft(normalized);
        setMessageError(getApiErrorMessage(error));
      }
    } finally {
      setIsSending(false);
    }
  };

  const retryMessage = async (message: ChatMessage) => {
    if (!activeConversation || retryingId) {
      return;
    }
    setRetryingId(message.id);
    setMessageError("");
    try {
      const response = await chatApi.retryMessage(
        activeConversation.id,
        message.id,
      );
      setMessages((current) =>
        uniqueMessages([
          ...current.map((item) =>
            item.id === response.user_message.id
              ? response.user_message
              : item,
          ),
          response.assistant_message,
        ]),
      );
      setConversations((current) =>
        upsertConversation(current, response.conversation),
      );
      shouldStickToBottom.current = true;
    } catch (error) {
      if (error instanceof ChatProviderError) {
        handleProviderFailure(error);
      } else {
        setMessageError(getApiErrorMessage(error));
      }
    } finally {
      setRetryingId(null);
    }
  };

  const copyMessage = async (message: ChatMessage) => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopiedId(message.id);
      window.setTimeout(() => {
        setCopiedId((current) => (current === message.id ? null : current));
      }, 1600);
    } catch {
      setMessageError("Could not copy the response. Please try again.");
    }
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    void sendQuestion(draft);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendQuestion(draft);
    }
  };

  const startNewConversation = () => {
    setActiveConversation(null);
    setMessages([]);
    setDraft("");
    setMessageError("");
  };

  const clearConversation = async (conversation: ChatConversation) => {
    setDeletingId(conversation.id);
    setConversationError("");
    try {
      await chatApi.archiveConversation(conversation.id);
      setConversations((current) => {
        const remaining = current.filter((item) => item.id !== conversation.id);
        if (activeConversation?.id === conversation.id) {
          setActiveConversation(remaining[0] ?? null);
        }
        return remaining;
      });
    } catch (error) {
      setConversationError(getApiErrorMessage(error));
    } finally {
      setDeletingId(null);
      setClearCandidate(null);
    }
  };

  const startRename = (conversation: ChatConversation) => {
    setRenamingId(conversation.id);
    setRenameDraft(conversation.title);
  };

  const cancelRename = () => {
    setRenamingId(null);
    setRenameDraft("");
  };

  const submitRename = async (conversation: ChatConversation) => {
    const title = renameDraft.trim();
    if (!title || title === conversation.title || savingRenameId) {
      cancelRename();
      return;
    }
    setSavingRenameId(conversation.id);
    setConversationError("");
    try {
      const renamed = await chatApi.renameConversation(conversation.id, title);
      setConversations((current) => upsertConversation(current, renamed));
      setActiveConversation((current) =>
        current?.id === renamed.id ? renamed : current,
      );
      cancelRename();
    } catch (error) {
      setConversationError(getApiErrorMessage(error));
    } finally {
      setSavingRenameId(null);
    }
  };

  return (
    <section
      className={`${styles.page} ${mode === "widget" ? styles.widgetPage : ""}`}
    >
      {mode === "widget" && isHistoryOpen ? (
        <button
          aria-label="Close conversation history"
          className={styles.historyScrim}
          onClick={() => setIsHistoryOpen(false)}
          type="button"
        />
      ) : null}
      <aside
        className={`${styles.historyPanel} ${
          mode === "widget" ? styles.widgetHistoryPanel : ""
        } ${isHistoryOpen ? styles.widgetHistoryOpen : ""}`}
        aria-label="Conversation history"
      >
        <div className={styles.historyHeader}>
          <h2>Conversations</h2>
          <Button
            aria-label="Start a new conversation"
            className={styles.iconButton}
            onClick={startNewConversation}
            title="New conversation"
          >
            <PlusIcon />
          </Button>
        </div>
        <div className={styles.conversationList}>
          {isLoadingConversations ? (
            <div className={styles.loaderState}>
              <LoadingSpinner label="Loading conversations" />
            </div>
          ) : null}
          {conversationError ? (
            <p className={styles.errorState}>{conversationError}</p>
          ) : null}
          {!isLoadingConversations && !conversations.length ? (
            <p className={styles.status}>No conversations yet.</p>
          ) : null}
          {conversations.map((conversation) => (
            <div
              className={`${styles.conversationItem} ${
                activeConversation?.id === conversation.id
                  ? styles.conversationItemActive
                  : ""
              }`}
              key={conversation.id}
            >
              {renamingId === conversation.id ? (
                <form
                  className={styles.renameForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void submitRename(conversation);
                  }}
                >
                  <input
                    aria-label="Conversation title"
                    autoFocus
                    maxLength={120}
                    onChange={(event) => setRenameDraft(event.target.value)}
                    value={renameDraft}
                  />
                  <button
                    aria-label="Save title"
                    disabled={savingRenameId === conversation.id}
                    title="Save title"
                    type="submit"
                  >
                    <CheckIcon />
                  </button>
                  <button
                    aria-label="Cancel rename"
                    disabled={savingRenameId === conversation.id}
                    onClick={cancelRename}
                    title="Cancel"
                    type="button"
                  >
                    <XIcon />
                  </button>
                </form>
              ) : (
                <button
                  className={styles.conversationSelect}
                  onClick={() => {
                    setActiveConversation(conversation);
                    if (mode === "widget") {
                      setIsHistoryOpen(false);
                    }
                  }}
                  type="button"
                >
                  <strong>{conversation.title}</strong>
                </button>
              )}
              {renamingId !== conversation.id ? (
                <button
                  aria-label={`Rename ${conversation.title}`}
                  className={styles.renameConversation}
                  disabled={deletingId === conversation.id}
                  onClick={() => startRename(conversation)}
                  title="Rename conversation"
                  type="button"
                >
                  <EditIcon />
                </button>
              ) : null}
              <button
                aria-label={`Clear ${conversation.title}`}
                className={styles.deleteConversation}
                disabled={deletingId === conversation.id}
                onClick={() => setClearCandidate(conversation)}
                title="Clear conversation"
                type="button"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section
        className={`${styles.chatPanel} ${
          mode === "widget" ? styles.widgetChatPanel : ""
        }`}
        aria-label="AI financial assistant"
      >
        {mode === "widget" ? (
          <header className={styles.widgetHeader}>
            <div className={styles.widgetTitle}>
              <AssistantMark />
              <div>
                <strong>MoneyMate AI</strong>
                <span>Financial assistant</span>
              </div>
            </div>
            <div className={styles.widgetActions}>
              <button
                aria-label="Conversation history"
                aria-expanded={isHistoryOpen}
                className={styles.widgetIconButton}
                onClick={() => setIsHistoryOpen((current) => !current)}
                title="Conversation history"
                type="button"
              >
                <ClockIcon />
              </button>
              <button
                aria-label="Start a new conversation"
                className={styles.widgetIconButton}
                onClick={startNewConversation}
                title="New conversation"
                type="button"
              >
                <PlusIcon />
              </button>
              <button
                aria-label="Clear conversation"
                className={styles.widgetIconButton}
                disabled={!activeConversation}
                onClick={() => {
                  if (activeConversation) {
                    setClearCandidate(activeConversation);
                  }
                }}
                title="Clear conversation"
                type="button"
              >
                <TrashIcon />
              </button>
              <button
                aria-label="Close AI chat"
                className={styles.widgetIconButton}
                onClick={onClose}
                title="Close"
                type="button"
              >
                <XIcon />
              </button>
            </div>
          </header>
        ) : null}
        <div
          className={styles.messages}
          onScroll={handleScroll}
          ref={messagesRef}
        >
          {hasMoreMessages ? (
            <Button
              className={styles.loadOlder}
              onClick={() => void loadOlderMessages()}
              variant="secondary"
            >
              Load older messages
            </Button>
          ) : null}
          {isLoadingMessages ? (
            <div className={styles.loaderState}>
              <LoadingSpinner label="Loading messages" />
            </div>
          ) : null}
          {!isLoadingMessages && !isSending && !messages.length ? (
            <div className={styles.emptyState}>
              <img
                alt=""
                aria-hidden="true"
                className={styles.assistantLogo}
                src="/moneymate-ai-assistant.png"
              />
              <h2>Hi, {firstName}</h2>
              <p>
                What would you like to understand about your money today?
              </p>
              <div className={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <button
                    disabled={isSending}
                    key={suggestion.question}
                    onClick={() => void sendQuestion(suggestion.question)}
                    type="button"
                  >
                    <span className={styles.suggestionIcon}>
                      <SuggestionIcon type={suggestion.icon} />
                    </span>
                    <span>{suggestion.question}</span>
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message) => (
            <MessageBubble
              isRetrying={retryingId === message.id}
              isCopied={copiedId === message.id}
              key={message.id}
              message={message}
              onCopy={copyMessage}
              onRetry={retryMessage}
            />
          ))}
          {isSending ? <TypingIndicator /> : null}
        </div>

        {showJumpLatest ? (
          <button
            aria-label="Jump to latest message"
            className={styles.jumpLatest}
            onClick={() => {
              shouldStickToBottom.current = true;
              setShowJumpLatest(false);
              scrollToBottom();
            }}
            title="Jump to latest"
            type="button"
          >
            <ArrowDownIcon />
          </button>
        ) : null}

        <footer className={styles.composer}>
          <form className={styles.composerForm} onSubmit={submit}>
            <div className={styles.inputRow}>
              <textarea
                aria-describedby={
                  validationMessage ? "chat-validation" : undefined
                }
                aria-label="Ask MoneyMate a financial question"
                disabled={isSending}
                id="chat-question"
                maxLength={maxQuestionLength + 1}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask about spending, budgets, savings goals..."
                ref={questionInputRef}
                rows={1}
                value={draft}
              />
              <Button
                aria-label={isSending ? "Sending message" : "Send message"}
                className={styles.sendButton}
                disabled={
                  isSending || !draft.trim() || Boolean(validationMessage)
                }
                type="submit"
                title="Send message"
              >
                <SendIcon />
              </Button>
            </div>
            {validationMessage ? (
              <p className={styles.validation} id="chat-validation">
                {validationMessage}
              </p>
            ) : null}
            {messageError ? (
              <p className={styles.errorState} aria-live="polite">
                {messageError}
              </p>
            ) : null}
          </form>
        </footer>
      </section>
      <Modal
        isOpen={Boolean(clearCandidate)}
        onClose={() => {
          if (!deletingId) {
            setClearCandidate(null);
          }
        }}
        title="Clear conversation?"
      >
        <div className={styles.confirmClear}>
          <p>
            This removes the conversation from your history. You can start a new
            chat whenever you are ready.
          </p>
          <div className={styles.confirmActions}>
            <Button
              disabled={Boolean(deletingId)}
              onClick={() => setClearCandidate(null)}
              variant="secondary"
            >
              Cancel
            </Button>
            <Button
              disabled={Boolean(deletingId)}
              onClick={() => {
                if (clearCandidate) {
                  void clearConversation(clearCandidate);
                }
              }}
              variant="danger"
            >
              {deletingId ? "Clearing..." : "Clear"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}
