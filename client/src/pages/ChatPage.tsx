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
import { Button } from "../components";
import { useAuth } from "../contexts/AuthContext";
import { getApiErrorMessage } from "../services/api";
import { chatApi, ChatProviderError } from "../services/chat";
import type { ChatConversation, ChatMessage } from "../types/chat";
import styles from "./ChatPage.module.css";

const maxQuestionLength = 1200;
const suggestions = [
  "How much did I spend this month?",
  "Which category did I spend the most on?",
  "How does my spending compare with last month?",
  "Am I staying within my budgets?",
  "How close am I to my savings goals?",
  "What was my net position this month?",
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

function renderMessageText(content: string) {
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

  return content
    .split(/\n{2,}|\n/)
    .filter((line) => line.trim())
    .map((line, index) => (
      <p key={`${index}-${line.slice(0, 12)}`}>{renderInline(line)}</p>
    ));
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
}: {
  message: ChatMessage;
  onRetry: (message: ChatMessage) => void;
  isRetrying: boolean;
}) {
  const isUser = message.role === "user";
  return (
    <article
      className={`${styles.messageRow} ${
        isUser ? styles.messageUser : styles.messageAssistant
      }`}
    >
      <div className={styles.bubble}>
        {renderMessageText(message.content)}
      </div>
      <div className={styles.messageMeta}>
        <time className={styles.messageTime}>
          {formatTimestamp(message.created_at)}
        </time>
        {message.status === "assistant_failed" ? (
          <Button
            disabled={isRetrying}
            onClick={() => onRetry(message)}
            variant="secondary"
          >
            Retry
          </Button>
        ) : null}
      </div>
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

export function ChatPage() {
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
  const [hasMoreMessages, setHasMoreMessages] = useState(false);
  const [nextBeforeMessageId, setNextBeforeMessageId] = useState<number | null>(
    null,
  );
  const [showJumpLatest, setShowJumpLatest] = useState(false);
  const messagesRef = useRef<HTMLDivElement | null>(null);
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
    setMessageError(error.failure.message);
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

  const deleteConversation = async (conversation: ChatConversation) => {
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
    }
  };

  return (
    <section className={styles.page}>
      <aside className={styles.historyPanel} aria-label="Conversation history">
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
          {isLoadingConversations ? <p className={styles.status}>Loading...</p> : null}
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
              <button
                className={styles.conversationSelect}
                onClick={() => setActiveConversation(conversation)}
                type="button"
              >
                <strong>{conversation.title}</strong>
              </button>
              <button
                aria-label={`Delete ${conversation.title}`}
                className={styles.deleteConversation}
                disabled={deletingId === conversation.id}
                onClick={() => void deleteConversation(conversation)}
                title="Delete conversation"
                type="button"
              >
                <TrashIcon />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section className={styles.chatPanel} aria-label="AI financial assistant">
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
          {isLoadingMessages ? <p className={styles.status}>Loading messages...</p> : null}
          {!isLoadingMessages && !isSending && !messages.length ? (
            <div className={styles.emptyState}>
              <div className={styles.assistantMark} aria-hidden="true">
                <span />
              </div>
              <h2>Hi, {firstName}</h2>
              <p>
                What would you like to understand about your money today?
              </p>
              <span className={styles.promptLabel}>Try these prompts</span>
              <div className={styles.suggestions}>
                {suggestions.map((suggestion) => (
                  <button
                    disabled={isSending}
                    key={suggestion}
                    onClick={() => void sendQuestion(suggestion)}
                    type="button"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
          {messages.map((message) => (
            <MessageBubble
              isRetrying={retryingId === message.id}
              key={message.id}
              message={message}
              onRetry={retryMessage}
            />
          ))}
          {isSending ? <TypingIndicator /> : null}
        </div>

        {showJumpLatest ? (
          <Button
            className={styles.jumpLatest}
            onClick={() => {
              shouldStickToBottom.current = true;
              setShowJumpLatest(false);
              scrollToBottom();
            }}
            variant="secondary"
          >
            Jump to latest
          </Button>
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
    </section>
  );
}
