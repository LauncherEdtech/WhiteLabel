import Cookies from "js-cookie";
const SECURE = process.env.NODE_ENV === "production";
export const cookies = {
  get:    (key: string) => Cookies.get(key),
  set:    (key: string, value: string, days = 1) =>
    Cookies.set(key, value, { expires: days, sameSite: "lax", secure: SECURE }),
  remove: (key: string) => Cookies.remove(key, { path: "/" }),
  getAccessToken:  () => Cookies.get("access_token"),
  getRefreshToken: () => Cookies.get("refresh_token"),
  getTenantSlug:   () => Cookies.get("tenant_slug") || "concurso-demo",
  setTokens: (access: string, refresh: string) => {
    Cookies.set("access_token",  access,  { expires: 1/24, sameSite: "lax", secure: SECURE });
    Cookies.set("refresh_token", refresh, { expires: 30,   sameSite: "lax", secure: SECURE });
  },
  clearAuth: () => {
    ["access_token", "refresh_token"].forEach(k => Cookies.remove(k, { path: "/" }));
  },
};
