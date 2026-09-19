export const ASK_PANEL_ID = "ask-potential";

export function keepAskAhead(event: {
  target: EventTarget | null;
  preventDefault: () => void;
}) {
  if (event.target instanceof Element && event.target.closest(`#${ASK_PANEL_ID}`)) {
    event.preventDefault();
  }
}
