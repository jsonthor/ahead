export const ACTIVITY_INSIGHT_ASK_EVENT = "ahead:ask-session";

export function askAboutActivityInsight() {
  window.dispatchEvent(
    new CustomEvent(ACTIVITY_INSIGHT_ASK_EVENT, {
      detail: { message: "How did this session look?" },
    }),
  );
}
