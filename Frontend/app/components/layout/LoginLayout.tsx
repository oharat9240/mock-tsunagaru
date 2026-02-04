import { Anchor, Group, Title } from "@mantine/core";
import { Link } from "react-router";
import { ThemeToggle } from "../common/ThemeToggle";

interface LoginLayoutProps {
  children: React.ReactNode;
}

export const LoginLayout = ({ children }: LoginLayoutProps) => {
  return (
    <>
      <Group justify="space-between" p="md">
        <Anchor component={Link} to="/" td="none">
          <Title order={3} c="blue">
            もっく！つながるサイネージ
          </Title>
        </Anchor>
        <ThemeToggle />
      </Group>
      {children}
    </>
  );
};
