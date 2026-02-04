import { useEffect, useState } from "react";
import { LayoutUsageDisplay } from "~/components/layout/LayoutUsageDisplay";
import { useLayout } from "~/hooks/useLayout";
import type { LayoutItem, Orientation, Region } from "~/types/layout";
import { LayoutFormModal } from "./LayoutFormModal";

interface LayoutFormData {
  name: string;
  orientation: Orientation;
  regions: Region[];
}

interface LayoutEditModalProps {
  opened: boolean;
  layoutId: string | null;
  onClose: () => void;
  onSubmit: (data: LayoutFormData) => Promise<void>;
}

export const LayoutEditModal = ({ opened, layoutId, onClose, onSubmit }: LayoutEditModalProps) => {
  const [layoutData, setLayoutData] = useState<LayoutItem | null>(null);
  const [_loading, setLoading] = useState(false);
  const [dataReady, setDataReady] = useState(false);
  const { getLayoutById } = useLayout();

  // レイアウトデータを取得
  useEffect(() => {
    if (opened && layoutId) {
      const loadLayoutData = async () => {
        setLoading(true);
        setDataReady(false);
        try {
          const data = await getLayoutById(layoutId);
          setLayoutData(data);
          setDataReady(true);
        } catch (error) {
          console.error("Failed to load layout data:", error);
          setLayoutData(null);
          setDataReady(false);
        } finally {
          setLoading(false);
        }
      };

      loadLayoutData();
    } else {
      setLayoutData(null);
      setDataReady(false);
    }
  }, [opened, layoutId, getLayoutById]);

  const handleClose = () => {
    setLayoutData(null);
    setDataReady(false);
    onClose();
  };

  // データが準備できていない場合は何も表示しない
  if (opened && layoutId && (!dataReady || !layoutData)) {
    return null;
  }

  const initialData = layoutData
    ? {
        name: layoutData.name,
        orientation: layoutData.orientation,
        regions: layoutData.regions,
      }
    : undefined;

  return (
    <LayoutFormModal
      opened={opened && dataReady && !!layoutData}
      onClose={handleClose}
      onSubmit={onSubmit}
      title="レイアウトを編集"
      submitButtonText="保存"
      initialData={initialData}
      additionalContent={layoutId ? <LayoutUsageDisplay layoutId={layoutId} /> : undefined}
    />
  );
};
