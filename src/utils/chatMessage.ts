export const getLastChatSenderId = (chat: Record<string, any>): string =>
  String(
    chat.lastSenderId ??
      chat.lastMessageSenderId ??
      chat.lastSender ??
      chat.senderId ??
      ""
  );
