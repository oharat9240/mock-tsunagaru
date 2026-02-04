import { ActionIcon, Tooltip, useMantineColorScheme } from "@mantine/core";
import { IconMoon, IconSun } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { colorSchemeAtom } from "~/states";

export const ThemeToggle = () => {
  const [colorScheme, setColorScheme] = useAtom(colorSchemeAtom);
  const { setColorScheme: setMantineColorScheme } = useMantineColorScheme();

  const toggleColorScheme = () => {
    const newScheme = colorScheme === "dark" ? "light" : "dark";
    setColorScheme(newScheme);
    // Mantineのカラースキームを直接更新
    setMantineColorScheme(newScheme);
  };

  return (
    <Tooltip label={`${colorScheme === "dark" ? "ライト" : "ダーク"}テーマに切り替え`}>
      <ActionIcon onClick={toggleColorScheme} variant="subtle" color="white" size="lg" aria-label="テーマ切り替え">
        {colorScheme === "dark" ? <IconSun size={18} /> : <IconMoon size={18} />}
      </ActionIcon>
    </Tooltip>
  );
};
