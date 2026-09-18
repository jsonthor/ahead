import { BRAND_MARKS } from "@/components/brands/marks";
import { providerById, type ProviderId } from "@/lib/integrations";
import { isOauthProvider } from "@/lib/oauth";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function PermissionPage({
  params,
  searchParams,
}: PageProps<"/connect/[provider]/permission">) {
  const { provider } = await params;
  const query = await searchParams;
  if (!isOauthProvider(provider)) {
    notFound();
  }
  const brand = providerById(provider as ProviderId);
  const Mark = BRAND_MARKS[provider as ProviderId];
  const state = typeof query.state === "string" ? query.state : "";
  const allowHref = `/api/integrations/${provider}/callback?code=preview&state=${encodeURIComponent(state)}`;
  const denyHref = `/api/integrations/${provider}/callback?error=access_denied&state=${encodeURIComponent(state)}`;

  return (
    <div className="mx-auto flex min-h-full max-w-md flex-col justify-center px-4 py-16">
      <div className="flex items-center gap-3">
        <Mark />
        <p className="text-sm font-medium text-ink">{brand.name}</p>
      </div>
      <h1 className="mt-6 text-3xl font-medium tracking-[-0.04em] text-ink">
        Allow Potential to read your completed training?
      </h1>
      <p className="mt-3 text-[15px] leading-6 text-ink-soft">
        {brand.name} will share completed workouts with Potential so it can
        build its own activity record. Potential will not send workouts back
        to {brand.name}.
      </p>
      <div className="mt-8 grid gap-2">
        <Link
          href={allowHref}
          className="home-cta"
        >
          Allow
        </Link>
        <Link
          href={denyHref}
          className="inline-flex h-11 items-center justify-center rounded-sm border border-line text-sm text-ink hover:bg-paper-sunken"
        >
          Deny
        </Link>
      </div>
      <p className="mt-6 text-[13px] leading-5 text-muted">
        This is the permission step. With {brand.name} API credentials in
        env, you go to {brand.name} itself instead.
      </p>
    </div>
  );
}
