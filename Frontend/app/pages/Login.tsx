import { Alert, Button, Container, Paper, PasswordInput, Stack, Text, TextInput, Title } from "@mantine/core";
import { IconInfoCircle } from "@tabler/icons-react";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { env } from "~/config/env";
import { isAuthenticatedAtom, loginAtom } from "~/states";
import type { Route } from "./+types/Login";

export const meta = (_args: Route.MetaArgs) => {
  return [{ title: `ログイン - ${env.appTitle}` }, { name: "description", content: `${env.appTitle} にログイン` }];
};

const Login = () => {
  const [userId, setUserId] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [, login] = useAtom(loginAtom);
  const [isAuthenticated] = useAtom(isAuthenticatedAtom);
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated) {
      navigate("/", { replace: true });
    }
  }, [isAuthenticated, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!userId.trim() || !password.trim()) {
      return;
    }

    setIsLoading(true);

    // Simulate API call delay
    await new Promise((resolve) => setTimeout(resolve, 500));

    // Demo login - accept any non-empty credentials
    const user = {
      id: userId,
      email: `${userId}@example.com`,
      name: userId,
      role: "user" as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    login(user);
    setIsLoading(false);
  };

  // 開発用アカウントでログイン
  const handleDevLogin = (type: "admin" | "user") => {
    const creds = type === "admin" ? env.devAdmin : env.devUser;
    setUserId(creds.email.split("@")[0]);
    setPassword(creds.password);
  };

  return (
    <Container size={480} my={40}>
      <Stack align="center" mb="md">
        <Title ta="center">{env.appTitle}</Title>
        <Text size="sm" c="dimmed">
          {env.appSubtitle}
        </Text>
      </Stack>

      <Paper withBorder shadow="md" p={30} mt={30} radius="md">
        <form onSubmit={handleSubmit}>
          <TextInput
            label="ユーザーID"
            placeholder="ユーザーIDを入力してください"
            required
            value={userId}
            onChange={(event) => setUserId(event.currentTarget.value)}
            mb="sm"
          />
          <PasswordInput
            label="パスワード"
            placeholder="パスワードを入力してください"
            required
            value={password}
            onChange={(event) => setPassword(event.currentTarget.value)}
            mb="lg"
          />
          <Button type="submit" fullWidth loading={isLoading} disabled={!userId.trim() || !password.trim()}>
            ログイン
          </Button>

          {env.isDevelopment && (
            <Alert icon={<IconInfoCircle size={16} />} title="開発用アカウント" color="blue" mt="md">
              <Stack gap="xs">
                <Text size="xs">デモ用のため、任意の認証情報でログインできます。</Text>
                <Button.Group>
                  <Button size="xs" variant="light" onClick={() => handleDevLogin("admin")}>
                    管理者
                  </Button>
                  <Button size="xs" variant="light" onClick={() => handleDevLogin("user")}>
                    一般ユーザー
                  </Button>
                </Button.Group>
              </Stack>
            </Alert>
          )}
        </form>
      </Paper>

      <Text size="xs" c="dimmed" ta="center" mt="md">
        v{env.appVersion}
      </Text>
    </Container>
  );
};

export default Login;
