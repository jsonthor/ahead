export const SESSION_ASK_EVENT = "ahead:ask-session";

export function askAboutSession() {
  window.dispatchEvent(
    new CustomEvent(SESSION_ASK_EVENT, {
      detail: { message: "How did this session look?" },
    }),
  );
}
