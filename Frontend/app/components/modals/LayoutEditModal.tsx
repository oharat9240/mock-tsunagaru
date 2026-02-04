import { Alert, Center, Loader, Modal } from "@mantine/core";
import { IconAlertCircle } from "@tabler/icons-react";
import { useCallback, useEffect, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dataReady, setDataReady] = useState(false);
  const { getLayoutById } = useLayout();

  // レイアウトデータを取得
  const loadData = useCallback(async () => {
    if (!layoutId) return;

    setLoading(true);
    setError(null);
    setDataReady(false);

    try {
      const data = await getLayoutById(layoutId);
      if (data) {
        setLayoutData(data);
        setDataReady(true);
      } else {
        setError("レイアウトが見つかりません");
        setLayoutData(null);
      }
    } catch (err) {
      console.error("Failed to load layout data:", err);
      setError(err instanceof Error ? err.message : "レイアウトの読み込みに失敗しました");
      setLayoutData(null);
    } finally {
      setLoading(false);
    }
  }, [layoutId, getLayoutById]);

  useEffect(() => {
    if (opened && layoutId) {
      loadData();
    } else {
      setLayoutData(null);
      setDataReady(false);
      setError(null);
    }
  }, [opened, layoutId, loadData]);

  const handleClose = () => {
    setLayoutData(null);
    setDataReady(false);
    setError(null);
    onClose();
  };

  // ローディング中またはエラー時はローディング/エラーモーダルを表示
  if (opened && layoutId && (loading || error || !dataReady)) {
    return (
      <Modal opened={opened} onClose={handleClose} title="レイアウトを編集" centered>
        {loading && (
          <Center py="xl">
            <Loader size="lg" />
          </Center>
        )}
        {error && (
          <Alert icon={<IconAlertCircle size={16} />} color="red" title="エラー">
            {error}
          </Alert>
        )}
      </Modal>
    );
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
