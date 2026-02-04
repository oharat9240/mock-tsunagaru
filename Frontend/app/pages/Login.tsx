import { Button, Container, Paper, PasswordInput, Text, TextInput, Title } from "@mantine/core";
import { useAtom } from "jotai";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { isAuthenticatedAtom, loginAtom } from "~/states";
import type { Route } from "./+types/Login";

export const meta = (_args: Route.MetaArgs) => {
  return [{ title: "ログイン - Tsunagaru" }, { name: "description", content: "Tsunagaru にログイン" }];
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
    await new Promise((resolve) => setTimeout(resolve, 1000));

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

  return (
    <Container size={480} my={40}>
      <Title ta="center" mb="md">
        もっく！つながるサイネージ
      </Title>

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
          <Text size="sm" c="dimmed" mt="md">
            デモページです。空欄以外のユーザーIDとパスワードでログインできます。
          </Text>
        </form>
      </Paper>
    </Container>
  );
};

export default Login;
