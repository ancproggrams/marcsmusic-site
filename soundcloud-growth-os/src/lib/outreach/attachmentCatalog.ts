export type OutreachAttachmentId =
  | "door-de-storm"
  | "strijd"
  | "geen-afscheid"
  | "weekend-mode"
  | "summer-time"
  | "carnival";

export type OutreachAttachment = {
  id: OutreachAttachmentId;
  label: string;
  filename: string;
  relativePath: string;
};

export const outreachAttachments: OutreachAttachment[] = [
  {
    id: "door-de-storm",
    label: "Door de Storm",
    filename: "Door de Storm.mp3",
    relativePath: "01 Door de Storm/Door de Storm.mp3"
  },
  {
    id: "strijd",
    label: "Strijd",
    filename: "Strijd.mp3",
    relativePath: "02 Strijd/Strijd.mp3"
  },
  {
    id: "geen-afscheid",
    label: "Geen Afscheid",
    filename: "Geen Afscheid.mp3",
    relativePath: "03 Geen Afscheid/Geen Afscheid.mp3"
  },
  {
    id: "weekend-mode",
    label: "Weekend Mode",
    filename: "Weekend Mode.mp3",
    relativePath: "04 Weekend Mode/Weekend Mode.mp3"
  },
  {
    id: "summer-time",
    label: "Summer Time",
    filename: "Summer Time.mp3",
    relativePath: "05 Summer Time/Summer Time.mp3"
  },
  {
    id: "carnival",
    label: "Carnival",
    filename: "Carnival.mp3",
    relativePath: "06 Carnival/Carnival.mp3"
  }
];
