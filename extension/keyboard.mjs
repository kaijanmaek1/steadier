// Closed-shadow controls appear as the host DIV to page-wide shortcut handlers.
// Stop those shortcuts at window capture, without cancelling native editing.
export function isolateEditableKeys(event,host,focused) {
  if(!event.composedPath().includes(host) || !focused?.matches('input,textarea,select,[contenteditable="true"]')) return false;
  event.stopImmediatePropagation();
  return true;
}
