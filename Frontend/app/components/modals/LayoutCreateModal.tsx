import type { Orientation, Region } from "~/types/layout";
import { LayoutFormModal } from "./LayoutFormModal";

interface LayoutFormData {
  name: string;
  orientation: Orientation;
  regions: Region[];
}

interface LayoutCreateModalProps {
  opened: boolean;
  onClose: () => void;
  onSubmit: (data: LayoutFormData) => Promise<void>;
}

export const LayoutCreateModal = ({ opened, onClose, onSubmit }: LayoutCreateModalProps) => {
  return (
    <LayoutFormModal
      opened={opened}
      onClose={onClose}
      onSubmit={onSubmit}
      title="新しいレイアウトを作成"
      submitButtonText="作成"
    />
  );
};
