import { api, type ApiError } from "./api";
import type {
  ChatConversation,
  ChatConversationListResponse,
  ChatMessagesResponse,
  ChatProviderFailure,
  ChatSendMessageResponse,
} from "../types/chat";

function providerFailureFromError(error: unknown) {
  const detail = (error as ApiError | undefined)?.details;
  if (!detail || typeof detail !== "object") {
    return null;
  }
  const payload = (detail as Record<string, unknown>)["detail"];
  if (!payload || typeof payload !== "object") {
    return null;
  }
  const record = payload as Partial<ChatProviderFailure>;
  if (record.user_message && record.conversation && record.message) {
    return record as ChatProviderFailure;
  }
  return null;
}

export class ChatProviderError extends Error {
  failure: ChatProviderFailure;

  constructor(failure: ChatProviderFailure) {
    super(failure.message);
    this.failure = failure;
  }
}

async function withProviderFailure<T>(operation: Promise<T>) {
  try {
    return await operation;
  } catch (error) {
    const failure = providerFailureFromError(error);
    if (failure) {
      throw new ChatProviderError(failure);
    }
    throw error;
  }
}

export const chatApi = {
  conversations: (page = 1, pageSize = 20) =>
    api.get<ChatConversationListResponse>(
      `/chat/conversations?page=${page}&page_size=${pageSize}`,
    ),

  createConversation: () =>
    api.post<ChatConversation>("/chat/conversations", {}),

  renameConversation: (id: number, title: string) =>
    api.patch<ChatConversation>(`/chat/conversations/${id}`, { title }),

  archiveConversation: (id: number) =>
    api.delete<void>(`/chat/conversations/${id}`),

  messages: (
    conversationId: number,
    limit = 30,
    beforeMessageId?: number | null,
  ) => {
    const search = new URLSearchParams({ limit: String(limit) });
    if (beforeMessageId) {
      search.set("before_message_id", String(beforeMessageId));
    }
    return api.get<ChatMessagesResponse>(
      `/chat/conversations/${conversationId}/messages?${search.toString()}`,
    );
  },

  sendMessage: (conversationId: number, question: string) =>
    withProviderFailure(
      api.post<ChatSendMessageResponse>(
        `/chat/conversations/${conversationId}/messages`,
        { question },
      ),
    ),

  retryMessage: (conversationId: number, messageId: number) =>
    withProviderFailure(
      api.post<ChatSendMessageResponse>(
        `/chat/conversations/${conversationId}/messages/${messageId}/retry`,
        {},
      ),
    ),
};
