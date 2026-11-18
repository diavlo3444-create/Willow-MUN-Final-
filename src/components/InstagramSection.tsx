import { useEffect, useState, type MouseEvent } from 'react';
import { ArrowUpRight, Instagram } from 'lucide-react';
import {
  DEFAULT_INSTAGRAM_ACCOUNT,
  WILLOW_INSTAGRAM_HANDLE,
  WILLOW_INSTAGRAM_URL,
  fetchOfficialInstagramFeed,
  type InstagramFeedResponse,
} from '../utils/instagramFeed';
import { ParallaxFrame, RevealItem } from './MotionPrimitives';
import { RevealSection, SectionHeading } from './RevealSection';

/**
 * Section 05: Official Instagram Presence (@willow.mun)
 * - Links directly to https://www.instagram.com/willow.mun/
 * - Renders official Instagram Graph API media in a responsive grid when credentials
 *   are configured on the server-side `willow-instagram` Edge Function
 * - Renders an intentional architectural editorial showcase when live API credentials
 *   are unavailable (zero fabricated posts or placeholder grids)
 */
export function InstagramSection() {
  const [feed, setFeed] = useState<InstagramFeedResponse>({
    configured: false,
    account: DEFAULT_INSTAGRAM_ACCOUNT,
    posts: [],
  });
  const [failedImageIds, setFailedImageIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    let active = true;
    const loadFeed = async () => {
      const response = await fetchOfficialInstagramFeed(6);
      if (active) {
        setFeed(response);
      }
    };
    void loadFeed();
    return () => {
      active = false;
    };
  }, []);

  const visiblePosts = feed.posts.filter((post) => !failedImageIds[post.id]);
  const hasLivePosts = feed.configured && visiblePosts.length > 0;
  const profileUrl = feed.account.profileUrl || WILLOW_INSTAGRAM_URL;
  const handle = feed.account.handle || WILLOW_INSTAGRAM_HANDLE;

  const handleAnchor = (event: MouseEvent<HTMLAnchorElement>, href: string) => {
    const target = document.querySelector(href);
    if (target) {
      event.preventDefault();
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  return (
    <RevealSection id="instagram" ariaLabelledBy="instagram-heading">
      {/* Header Row */}
      <div className="mb-8 sm:mb-12 grid grid-cols-1 lg:grid-cols-12 items-end gap-6 lg:gap-12 border-b border-[#ede6ca]/18 pb-6">
        <div className="lg:col-span-7">
          <SectionHeading
            id="instagram-heading"
            indexLabel="05"
            label="Official Channel"
            prefix="Follow"
            italicWord={handle}
          />
        </div>

        <RevealItem
          staggerIndex={1}
          className="lg:col-span-5 flex flex-col sm:flex-row lg:flex-col xl:flex-row sm:items-center lg:items-start xl:items-center justify-between gap-4"
        >
          <p className="text-sm leading-[1.7] text-[#cfc8aa] max-w-[40ch]">
            Official conference photography, Secretariat introductions, and committee announcements
            shared on Instagram.
          </p>

          <a
            href={profileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="mun-btn-interactive group inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-[2px] bg-[#ede6ca] px-5 py-2.5 text-xs font-semibold text-[#181c0d] hover:bg-[#dad3b4] whitespace-nowrap shrink-0"
          >
            <Instagram className="h-4 w-4 shrink-0" aria-hidden="true" />
            <span>Follow {handle}</span>
            <ArrowUpRight
              className="h-3.5 w-3.5 transition-transform duration-200 ease-out group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
              aria-hidden="true"
            />
          </a>
        </RevealItem>
      </div>

      {hasLivePosts ? (
        /* Live Official Instagram Graph API Media Grid */
        <div className="space-y-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {visiblePosts.map((post, idx) => (
              <RevealItem key={post.id} staggerIndex={idx + 1} className="min-w-0">
                <a
                  href={post.permalink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mun-card group flex h-full flex-col overflow-hidden rounded-[3px] focus-visible:outline-none"
                >
                  <div className="relative aspect-[4/5] w-full overflow-hidden bg-[#101408] border-b border-[#ede6ca]/14">
                    <img
                      src={post.imageUrl}
                      alt={
                        post.captionExcerpt
                          ? `${handle}: ${post.captionExcerpt}`
                          : `Official Willow MUN post on ${handle}`
                      }
                      loading="lazy"
                      onError={() =>
                        setFailedImageIds((prev) => ({ ...prev, [post.id]: true }))
                      }
                      className="mun-eb-photo h-full w-full object-cover"
                    />
                  </div>

                  <div className="flex flex-1 flex-col justify-between gap-3 p-5">
                    <div className="flex items-center justify-between gap-3 font-mono text-[10px] uppercase tracking-[0.14em] text-[#a9b47e]">
                      <span>
                        {post.mediaType === 'VIDEO'
                          ? 'Reel'
                          : post.mediaType === 'CAROUSEL_ALBUM'
                            ? 'Series'
                            : 'Dispatch'}
                      </span>
                      {post.formattedDate ? (
                        <time dateTime={post.timestamp} className="text-[#cfc8aa]/75">
                          {post.formattedDate}
                        </time>
                      ) : null}
                    </div>

                    {post.captionExcerpt ? (
                      <p className="text-sm leading-[1.68] text-[#dcd5ba] line-clamp-3">
                        {post.captionExcerpt}
                      </p>
                    ) : (
                      <p className="font-serif text-lg italic text-[#cfc8aa]">
                        Published on {handle}
                      </p>
                    )}

                    <div className="pt-2 border-t border-[#ede6ca]/10 flex items-center justify-between text-xs font-medium text-[#ede6ca] group-hover:text-[#a9b47e] transition-colors">
                      <span>View post on Instagram</span>
                      <ArrowUpRight
                        className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                        aria-hidden="true"
                      />
                    </div>
                  </div>
                </a>
              </RevealItem>
            ))}
          </div>
        </div>
      ) : (
        /* Refined Editorial Showcase Fallback when Instagram API tokens are not provisioned */
        <div className="willow-folio rounded-[3px] grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
          <div className="lg:col-span-6 relative flex flex-col justify-between gap-8 p-6 sm:p-10 border-b lg:border-b-0 lg:border-r border-[#ede6ca]/16 overflow-hidden">
            <ParallaxFrame
              offsetPx={12}
              className="pointer-events-none absolute -right-10 -bottom-10 opacity-[0.1] select-none"
            >
              <img
                src="/willow-tree-only.svg"
                alt=""
                aria-hidden="true"
                className="w-56 sm:w-72 h-auto"
              />
            </ParallaxFrame>

            <RevealItem staggerIndex={1} className="relative z-10 space-y-4">
              <div className="flex items-center justify-between gap-4 border-b border-[#ede6ca]/14 pb-4">
                <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#a9b47e]">
                  Official Instagram
                </span>
                <span className="font-mono text-xs text-[#ede6ca]">{handle}</span>
              </div>

              <h3 className="font-serif text-3xl sm:text-4xl font-medium leading-[1.08] text-[#ede6ca] [text-wrap:balance]">
                From the Secretariat Floor to Your Feed
              </h3>

              <p className="text-sm sm:text-[15px] leading-[1.78] text-[#d6cfb4] max-w-[48ch]">
                Follow{' '}
                <a
                  href={profileUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mun-link-underline font-medium text-[#ede6ca]"
                >
                  {handle}
                </a>{' '}
                for visual dispatches from the Willow MUN Secretariat, committee reveal notices,
                registration countdowns, and conference-day coverage.
              </p>
            </RevealItem>

            <RevealItem staggerIndex={2} className="relative z-10 pt-2 flex flex-wrap items-center gap-4">
              <a
                href={profileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mun-btn-interactive group inline-flex min-h-[44px] items-center justify-center gap-2.5 rounded-[2px] border border-[#ede6ca]/40 bg-[#181d0c]/85 px-5 py-2.5 text-xs font-semibold text-[#ede6ca] hover:bg-[#ede6ca] hover:text-[#181c0d] hover:border-[#ede6ca] whitespace-nowrap"
              >
                <Instagram className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span>Open {handle} Profile</span>
                <ArrowUpRight
                  className="h-3.5 w-3.5 transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5"
                  aria-hidden="true"
                />
              </a>

              <a
                href="#updates"
                onClick={(e) => handleAnchor(e, '#updates')}
                className="mun-link-underline text-xs font-medium text-[#cfc8aa] hover:text-[#ede6ca]"
              >
                Review official dispatches
              </a>
            </RevealItem>
          </div>

          <RevealItem staggerIndex={2} className="lg:col-span-6 p-6 sm:p-10 flex flex-col justify-between gap-6 bg-[#101408]/60">
            <div>
              <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[#a9b47e] mb-4">
                Channel Directory
              </p>

              <dl className="divide-y divide-[#ede6ca]/14 border-y border-[#ede6ca]/14 text-sm">
                <div className="py-4 flex items-baseline justify-between gap-4">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfc8aa]/75">
                    Account Handle
                  </dt>
                  <dd className="font-serif text-xl sm:text-2xl font-medium text-[#ede6ca]">
                    {handle}
                  </dd>
                </div>

                <div className="py-4 flex items-baseline justify-between gap-4">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfc8aa]/75">
                    Profile Address
                  </dt>
                  <dd className="text-right min-w-0">
                    <a
                      href={profileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mun-link-underline inline-flex items-center gap-1.5 font-mono text-xs text-[#ede6ca] hover:text-[#a9b47e] break-words"
                    >
                      <span>instagram.com/willow.mun</span>
                      <ArrowUpRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </a>
                  </dd>
                </div>

                <div className="py-4 flex items-baseline justify-between gap-4">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfc8aa]/75">
                    Editorial Coverage
                  </dt>
                  <dd className="text-xs sm:text-sm text-[#d6cfb4] text-right max-w-[32ch]">
                    Committee highlights, Secretariat announcements &amp; visual recaps
                  </dd>
                </div>

                <div className="py-4 flex items-baseline justify-between gap-4">
                  <dt className="font-mono text-[11px] uppercase tracking-[0.14em] text-[#cfc8aa]/75">
                    Managed By
                  </dt>
                  <dd className="text-xs sm:text-sm text-[#d6cfb4] text-right">
                    Media, Press &amp; Marketing Departments
                  </dd>
                </div>
              </dl>
            </div>

            <p className="text-xs leading-relaxed text-[#cfc8aa]/80">
              All external announcements published on {handle} correspond with the official
              conference milestones tracked in this prospectus.
            </p>
          </RevealItem>
        </div>
      )}
    </RevealSection>
  );
}
