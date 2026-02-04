import type { ContentAssignment } from "~/types/playlist";

export interface PlaylistFormData {
  name: string;
  device: string;
  layoutId: string;
  contentAssignments: ContentAssignment[];
}

export type Step = "basic" | "layout" | "content";

export interface StepInfo {
  key: Step;
  title: string;
  description: string;
}
