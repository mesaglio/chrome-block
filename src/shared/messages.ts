export function isPopupSender(sender: any, extensionId: string): boolean {
  return sender?.id === extensionId && sender.url === `chrome-extension://${extensionId}/popup/popup.html`;
}
export function isContentSender(sender: any, extensionId: string): boolean {
  return sender?.id === extensionId && Number.isInteger(sender.tab?.id) && sender.tab.id >= 0 &&
    Number.isInteger(sender.frameId) && sender.frameId >= 0 && typeof sender.documentId === 'string';
}
