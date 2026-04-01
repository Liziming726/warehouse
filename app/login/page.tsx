import LoginForm from "./login-form";
import { connection } from "next/server";

type LoginPageProps = {
  searchParams: Promise<{ next?: string | string[] }>;
};

function getSafeRedirectTarget(target?: string | null) {
  if (!target || !target.startsWith("/") || target.startsWith("//")) {
    return "/";
  }

  return target;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  await connection();

  const params = await searchParams;
  const nextValue = Array.isArray(params.next) ? params.next[0] : params.next;
  const redirectTo = getSafeRedirectTarget(nextValue);

  return <LoginForm redirectTo={redirectTo} />;
}
