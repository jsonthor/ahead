export const DIRECTION_ASK_EVENT = "ahead:ask-direction";

export type DirectionAskDetail = {
  date: string;
  message: string;
  label: string;
  score: number | null;
  conclusion: string;
};

let selection: Omit<DirectionAskDetail, "message"> | null = null;

export function setDirectionSelection(next: Omit<DirectionAskDetail, "message"> | null) {
  selection = next;
}

export function getDirectionSelection() {
  return selection;
}

export function askAboutDirection(detail: DirectionAskDetail) {
  setDirectionSelection({
    date: detail.date,
    label: detail.label,
    score: detail.score,
    conclusion: detail.conclusion,
  });
  window.dispatchEvent(new CustomEvent(DIRECTION_ASK_EVENT, { detail }));
}
