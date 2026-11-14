import { useState } from 'react';
import { ArrowDownRight } from 'lucide-react';
import { CONFERENCE_DATA } from '../data/conference';
import { members } from './ExecutiveBoardSection';
import { RevealSection, SectionHeading } from './RevealSection';

interface SecretariatSectionProps {
  onFindOnTree: (memberIndex: number) => void;
}

/**
 * Spotlight section introducing the Secretary-General and Deputy Secretary-General
 * directly from the shared Executive Board `members` array before the interactive tree.
 */
export function SecretariatSection({ onFindOnTree }: SecretariatSectionProps) {
  const [failedPhotos, setFailedPhotos] = useState<Record<string, boolean>>({});
  const leaders = members.slice(0, 2);

  return (
    <RevealSection id="secretariat" ariaLabelledBy="secretariat-heading">
      <div className="mb-10 sm:mb-12 text-center">
        <SectionHeading
          id="secretariat-heading"
          label="Leadership"
          prefix="MEET THE"
          italicWord="SECRETARIAT"
          period
          centered
        />
        <p className="mun-heading-reveal mt-3 text-xs sm:text-sm uppercase tracking-[0.2em] text-[#cfc8aa]">
          The Secretariat leading Willow MUN.
        </p>
      </div>

      <div className="mx-auto grid max-w-[880px] grid-cols-1 gap-6 sm:gap-8 md:grid-cols-2">
        {leaders.map((member, index) => {
          const photoSrc = member.photo
            ? member.photo.startsWith('/') || member.photo.startsWith('http')
              ? member.photo
              : `/${member.photo}`
            : '';
          const hasPhoto = Boolean(photoSrc) && !failedPhotos[member.photo];

          return (
            <div
              key={`${member.name}-${index}`}
              className="mun-card-reveal h-full"
              style={{ transitionDelay: `${index * 80}ms` }}
            >
              <article className="mun-card mun-secretariat-card flex h-full flex-col rounded-[28px] p-4 sm:p-5">
                <div className="aspect-[4/5] w-full overflow-hidden rounded-[24px] border border-[#ede6ca]/15 bg-[#232814]">
                  {hasPhoto ? (
                    <img
                      src={photoSrc}
                      alt={`${member.name}, ${member.role}`}
                      style={{ objectPosition: 'center 20%' }}
                      onError={() =>
                        setFailedPhotos((prev) => ({ ...prev, [member.photo]: true }))
                      }
                      className="mun-secretariat-photo h-full w-full object-cover"
                    />
                  ) : (
                    <div className="mun-secretariat-photo flex h-full w-full flex-col items-center justify-center p-10 text-center">
                      <img
                        src={CONFERENCE_DATA.brand.logoSrc}
                        alt=""
                        className="h-28 w-28 object-contain opacity-65"
                      />
                      <span className="mt-4 text-[11px] uppercase tracking-[0.22em] text-[#cfc8aa]/70 whitespace-nowrap">
                        Portrait Pending
                      </span>
                    </div>
                  )}
                </div>

                <div className="flex flex-1 flex-col justify-between px-2 pt-5 pb-1">
                  <div>
                    <h3 className="font-serif text-[clamp(1.75rem,3.6vw,2.4rem)] font-medium leading-[1.08] text-[#ede6ca] [text-wrap:balance]">
                      {member.name}
                    </h3>
                    <p className="mt-2 text-[clamp(10px,2.4vw,12px)] font-medium uppercase tracking-[0.22em] text-[#cfc8aa] whitespace-nowrap">
                      {member.role}
                    </p>
                  </div>

                  <div className="mt-5 border-t border-[#ede6ca]/12 pt-3">
                    <button
                      type="button"
                      onClick={() => onFindOnTree(index)}
                      className="inline-flex min-h-[44px] items-center gap-1.5 text-xs font-medium uppercase tracking-[0.18em] text-[#a9b47e] transition-colors duration-200 hover:text-[#ede6ca] whitespace-nowrap cursor-pointer"
                    >
                      <span className="mun-link-underline">Find on the tree</span>
                      <ArrowDownRight className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              </article>
            </div>
          );
        })}
      </div>
    </RevealSection>
  );
}
