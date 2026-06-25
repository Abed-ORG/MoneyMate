export type ChatRole = "user" | "assistant";
export type ChatMessageStatus = "complete" | "assistant_failed";

export type ChatSource = {
  type: string;
  label: string;
  start_date?: string | null;
  end_date?: string | null;
};

export type ChatMessage = {
  id: number;
  conversation_id: number;
  role: ChatRole;
  content: string;
  created_at: string;
  sources: ChatSource[];
  metrics: Record<string, unknown>;
  status: ChatMessageStatus;
  error_code?: string | null;
};

export type ChatConversation = {
  id: number;
  title: string;
  created_at: string;
  updated_at: string;
  last_message_at?: string | null;
  last_message_preview?: string | null;
  message_count: number;
};

export type ChatConversationListResponse = {
  items: ChatConversation[];
  total: number;
  page: number;
  page_size: number;
};

export type ChatMessagesResponse = {
  items: ChatMessage[];
  has_more: boolean;
  next_before_message_id?: number | null;
};

export type ChatSendMessageResponse = {
  conversation: ChatConversation;
  user_message: ChatMessage;
  assistant_message: ChatMessage;
};

export type ChatProviderFailure = {
  message: string;
  retryable: boolean;
  user_message: ChatMessage;
  conversation: ChatConversation;
};
