import "@mantine/core/styles.css";
import "@mantine/dates/styles.css";
import "@mantine/notifications/styles.css";

import {
  Box,
  Code,
  ColorSchemeScript,
  Container,
  createTheme,
  MantineProvider,
  Stack,
  Text,
  Title,
} from "@mantine/core";
import { ModalsProvider } from "@mantine/modals";
import { Notifications } from "@mantine/notifications";
import { Provider } from "jotai";
import { isRouteErrorResponse, Links, Meta, Outlet, Scripts, ScrollRestoration } from "react-router";
import { AppLayout } from "~/components";
import type { Route } from "./+types/root";

export const links: Route.LinksFunction = () => [
  { rel: "preconnect", href: "https://fonts.googleapis.com" },
  {
    rel: "preconnect",
    href: "https://fonts.gstatic.com",
    crossOrigin: "anonymous",
  },
  {
    rel: "stylesheet",
    href: "https://fonts.googleapis.com/css2?family=Inter:ital,opsz,wght@0,14..32,100..900;1,14..32,100..900&display=swap",
  },
];

const theme = createTheme({
  // Theme customizations can be added here
});

const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
  return (
    <MantineProvider theme={theme} defaultColorScheme="auto">
      <ModalsProvider>
        <Notifications />
        {children}
      </ModalsProvider>
    </MantineProvider>
  );
};

export const Layout = ({ children }: { children: React.ReactNode }) => {
  return (
    <html lang="en" style={{ height: "100%", margin: 0, padding: 0 }} suppressHydrationWarning>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <ColorSchemeScript defaultColorScheme="auto" />
        <Meta />
        <Links />
      </head>
      <body style={{ margin: 0, padding: 0, width: "100%", height: "100%" }}>
        <Provider>
          <ThemeProvider>
            <Box w="100%" mih="100vh">
              {children}
            </Box>
          </ThemeProvider>
        </Provider>
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
};

const App = () => {
  return (
    <AppLayout>
      <Outlet />
    </AppLayout>
  );
};

export default App;

export const ErrorBoundary = ({ error }: Route.ErrorBoundaryProps) => {
  let message = "Oops!";
  let details = "An unexpected error occurred.";
  let stack: string | undefined;

  if (isRouteErrorResponse(error)) {
    message = error.status === 404 ? "404" : "Error";
    details = error.status === 404 ? "The requested page could not be found." : error.statusText || details;
  } else if (import.meta.env.DEV && error && error instanceof Error) {
    details = error.message;
    stack = error.stack;
  }

  return (
    <Container size="md" pt={64} p="md">
      <Stack gap="md">
        <Title order={1}>{message}</Title>
        <Text>{details}</Text>
        {stack && (
          <Code block w="100%" p="md" style={{ overflow: "auto" }}>
            {stack}
          </Code>
        )}
      </Stack>
    </Container>
  );
};
