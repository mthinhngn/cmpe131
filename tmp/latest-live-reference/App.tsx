import { useEffect, useState } from "react";
import Home from "./pages/Home";
import NotFound from "./pages/NotFound";
import Prerequisites from "./pages/Prerequisites";
import Overview from "./pages/Overview";

export default function App() {
  const [pathname, setPathname] = useState(() => window.location.pathname);

  useEffect(() => {
    const handlePopState = () => setPathname(window.location.pathname);
    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  if (pathname === "/" || pathname === "") return <Home />;
  if (pathname === "/prerequisites" || pathname === "/prerequisites/") return <Prerequisites />;
  if (pathname === "/overview" || pathname === "/overview/") return <Overview />;
  return <NotFound />;
}
