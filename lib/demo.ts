import "server-only";

export type DemoLoginCredentials = {
  email: string;
  password: string;
};

export function getDemoLoginCredentials(): DemoLoginCredentials | null {
  const email = process.env.DEMO_LOGIN_EMAIL?.trim();
  const password = process.env.DEMO_LOGIN_PASSWORD?.trim();

  if (!email || !password) {
    return null;
  }

  return { email, password };
}
