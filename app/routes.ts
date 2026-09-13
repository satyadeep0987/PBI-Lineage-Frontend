import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/setup-guide.tsx"),
  route("overview", "routes/home.tsx"),
  route("workspace/:section?", "routes/workspace.tsx"),
] satisfies RouteConfig;
