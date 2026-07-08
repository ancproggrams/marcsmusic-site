export function createEmailService({ mailProvider }) {
  if (!mailProvider || typeof mailProvider.sendMessage !== "function") {
    throw new TypeError("mailProvider with sendMessage(message) is required");
  }

  return Object.freeze({
    sendTransactionalEmail(message) {
      return mailProvider.sendMessage({
        ...message,
        tags: ["transactional", ...(message.tags ?? [])]
      });
    }
  });
}
