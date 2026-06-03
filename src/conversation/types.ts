/**
 * Core conversation type definitions for the MiMo CLI.
 */

/** The role of a message in a conversation. */
export type MessageRole = 'system' | 'user' | 'assistant' | 'tool';

/** The status of a message during its lifecycle. */
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'error';

/** Represents a tool call within a message. */
export interface ToolCall {
  /** Unique identifier for the tool call. */
  id: string;

  /** The type of tool call; always 'function'. */
  type: 'function';

  /** The function to be called. */
  function: {
    /** The name of the function. */
    name: string;

    /** The arguments to pass to the function (as a JSON string). */
    arguments: string;
  };
}

/** Represents a single message in a conversation. */
export interface Message {
  /** Unique identifier for the message. */
  id: string;

  /** The role of the message sender. */
  role: MessageRole;

  /** The text content of the message. */
  content: string;

  /** The current status of the message. */
  status: MessageStatus;

  /** ISO 8601 timestamp of when the message was created. */
  timestamp: string;

  /** Tool calls associated with this message (e.g., assistant requesting tool use). */
  toolCalls?: ToolCall[];

  /** The ID of the tool call this message is responding to (for tool role messages). */
  toolCallId?: string;

  /** The name of the tool/function (for tool role messages). */
  name?: string;

  /** The ID of the parent message in a threaded or branched conversation. */
  parentId?: string;

  /** The ID of the branch this message belongs to. */
  branchId?: string;
}

/** Represents a conversation (chat session). */
export interface Conversation {
  /** Unique identifier for the conversation. */
  id: string;

  /** Human-readable name of the conversation. */
  name: string;

  /** The messages in the conversation. */
  messages: Message[];

  /** ISO 8601 timestamp of when the conversation was created. */
  createdAt: string;

  /** ISO 8601 timestamp of the last update to the conversation. */
  updatedAt: string;

  /** The model used for this conversation. */
  model: string;

  /** Map of branch IDs to their respective messages. */
  branches: Map<string, Message[]>;

  /** The ID of the currently active branch. */
  currentBranch: string;
}

/** Represents the overall conversation session state. */
export interface ConversationSession {
  /** All conversations in the session. */
  conversations: Conversation[];

  /** The ID of the currently active conversation. */
  activeConversationId: string | null;
}

/** Events emitted during the conversation lifecycle. */
export type ConversationEvent =
  | { type: 'message:added'; conversationId: string; message: Message }
  | { type: 'message:updated'; conversationId: string; message: Message }
  | { type: 'message:streaming'; conversationId: string; messageId: string; chunk: string }
  | { type: 'message:completed'; conversationId: string; messageId: string }
  | { type: 'message:error'; conversationId: string; messageId: string; error: string }
  | { type: 'branch:created'; conversationId: string; branchId: string; parentBranchId?: string }
  | { type: 'branch:switched'; conversationId: string; branchId: string }
  | { type: 'conversation:created'; conversation: Conversation }
  | { type: 'conversation:deleted'; conversationId: string }
  | { type: 'session:loaded'; session: ConversationSession }
  | { type: 'session:saved'; session: ConversationSession };
