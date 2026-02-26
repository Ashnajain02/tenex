import { auth } from "@/lib/auth";
import { LandingPage } from "@/components/landing/LandingPage";

export default async function Home() {
  const session = await auth();
  const isLoggedIn = !!session?.user;

  return <LandingPage isLoggedIn={isLoggedIn} />;
}
