import Link from "next/link";
import Image from "next/image";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center" style={{ background: "var(--color-bg-base)" }}>
      <Link href="/" className="mb-8 flex items-center gap-2.5">
        <Image src="/logo.svg" alt="" width={32} height={32} className="h-8 w-8" />
        <span className="text-2xl font-semibold tracking-tight" style={{ color: "var(--color-text-primary)" }}>
          twix
        </span>
      </Link>
      <div className="w-full max-w-md px-8">{children}</div>
    </div>
  );
}
