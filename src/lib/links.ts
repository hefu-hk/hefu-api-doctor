import { doctorConfig } from "../config";

export const sourceLinks = {
  github: "https://github.com/hefu-hk/hefu-api-doctor",
  gitee: "https://gitee.com/hefu-oss/hefu-api-doctor",
};

export function hefuLink(path = "/"): string {
  const url = new URL(path, `${doctorConfig.hefuBaseUrl}/`);
  url.searchParams.set("utm_source", "api-doctor");
  url.searchParams.set("utm_medium", "open-source");
  url.searchParams.set("utm_campaign", "api-doctor-activation");
  return url.toString();
}
