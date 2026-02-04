import { useEffect } from "react";
import { useNavigate } from "react-router";

export default function IndexPage() {
  const navigate = useNavigate();

  useEffect(() => {
    // "/" にアクセスされた場合は "/playlist" にリダイレクト
    navigate("/playlist", { replace: true });
  }, [navigate]);

  return null;
}
