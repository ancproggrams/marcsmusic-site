export function createEmailService({ emailProvider, mailProvider }) {
  const provider = emailProvider ?? mailProvider;
  if (!provider || typeof provider.sendMessage !== "function") {
    throw new TypeError("emailProvider with sendMessage(message) is required");
  }

  return Object.freeze({
    sendTransactionalEmail(message) {
      return provider.sendMessage({
        ...message,
        tags: ["transactional", ...(message.tags ?? [])]
      });
    }
  });
}
