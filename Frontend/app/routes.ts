import { index, layout, type RouteConfig, route } from "@react-router/dev/routes";

export default [
  // ルートページ（playlistにリダイレクト）
  index("pages/Index.tsx"),
  // メインタブのレイアウト
  layout("components/layout/TabLayout.tsx", [
    route("/playlist", "pages/Playlist.tsx"),
    route("/schedule", "pages/Schedule.tsx"),
    route("/layout", "pages/Layout.tsx"),
    route("/contents", "pages/Contents.tsx"),
  ]),
  // 独立したページ
  route("/login", "pages/Login.tsx"),
  route("/settings", "pages/Settings.tsx"),
] satisfies RouteConfig;
