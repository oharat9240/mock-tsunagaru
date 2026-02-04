import type { ContentAssignment } from "~/types/playlist";

export interface PlaylistEditFormData {
  name: string;
  device: string;
  contentAssignments: ContentAssignment[];
}
