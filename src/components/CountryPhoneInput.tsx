import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import { ChevronDown, Search, Check } from 'lucide-react';
import {
  COUNTRY_CODES,
  findCountryByIso,
  formatAndValidatePhone,
  type CountryCodeOption,
} from '../data/countryCodes';

interface CountryPhoneInputProps {
  id: string;
  label: string;
  countryIso: string;
  localNumber: string;
  onCountryChange: (iso2: string) => void;
  onLocalNumberChange: (val: string) => void;
  error?: string;
  required?: boolean;
  hint?: string;
  autoComplete?: string;
}

export function CountryPhoneInput({
  id,
  label,
  countryIso,
  localNumber,
  onCountryChange,
  onLocalNumberChange,
  error,
  required = false,
  hint,
  autoComplete = 'tel-national',
}: CountryPhoneInputProps) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [highlightIndex, setHighlightIndex] = useState(0);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const searchInputRef = useRef<HTMLInputElement | null>(null);

  const selectedCountry = useMemo(() => findCountryByIso(countryIso), [countryIso]);

  const filteredCountries = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return COUNTRY_CODES;
    const digitsQuery = q.replace(/\D/g, '');
    return COUNTRY_CODES.filter((c) => {
      if (c.name.toLowerCase().includes(q)) return true;
      if (c.iso2.toLowerCase().includes(q)) return true;
      if (c.dialCode.toLowerCase().includes(q)) return true;
      if (digitsQuery && c.dialCode.replace(/\D/g, '').includes(digitsQuery)) return true;
      return false;
    });
  }, [search]);

  useEffect(() => {
    if (!open) return;
    setHighlightIndex(0);
    const raf = window.requestAnimationFrame(() => {
      searchInputRef.current?.focus();
    });
    const onOutsideClick = (event: MouseEvent | TouchEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', onOutsideClick);
    document.addEventListener('touchstart', onOutsideClick);
    return () => {
      window.cancelAnimationFrame(raf);
      document.removeEventListener('mousedown', onOutsideClick);
      document.removeEventListener('touchstart', onOutsideClick);
    };
  }, [open]);

  const handleSelect = (country: CountryCodeOption) => {
    onCountryChange(country.iso2);
    setOpen(false);
    setSearch('');
  };

  const handleSearchKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setHighlightIndex((i) => Math.min(filteredCountries.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setHighlightIndex((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && filteredCountries[highlightIndex]) {
      e.preventDefault();
      handleSelect(filteredCountries[highlightIndex]);
    }
  };

  const validation = useMemo(
    () => (localNumber.trim() ? formatAndValidatePhone(countryIso, localNumber) : null),
    [countryIso, localNumber],
  );

  return (
    <div ref={containerRef} className="relative">
      <div className="mb-1.5 flex items-baseline justify-between gap-2">
        <label htmlFor={id} className="block text-xs font-medium text-[#c9c2a6]">
          {label} {required ? '*' : <span className="opacity-70">(optional)</span>}
        </label>
        {validation?.valid && (
          <span className="font-mono text-[10px] text-[#a9b47e] tabular-nums">
            {validation.e164}
          </span>
        )}
      </div>

      <div
        className={`flex min-h-[44px] w-full items-stretch rounded-[2px] border bg-[#0e1208] transition-colors duration-150 ${
          error
            ? 'border-rose-400/60 focus-within:border-rose-300'
            : 'border-[#ede6ca]/24 focus-within:border-[#ede6ca]'
        }`}
      >
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-haspopup="listbox"
          aria-expanded={open}
          aria-label={`${label} country code: ${selectedCountry.name} ${selectedCountry.dialCode}`}
          className="inline-flex min-h-[44px] shrink-0 items-center gap-1.5 border-r border-[#ede6ca]/18 px-3 text-xs font-medium text-[#ede6ca] hover:bg-[#ede6ca]/[0.05] cursor-pointer whitespace-nowrap"
        >
          <span className="text-base leading-none" aria-hidden="true">
            {selectedCountry.flag}
          </span>
          <span className="font-mono tabular-nums">{selectedCountry.dialCode}</span>
          <ChevronDown
            className={`h-3.5 w-3.5 text-[#c9c2a6] transition-transform duration-150 ${
              open ? 'rotate-180' : ''
            }`}
            aria-hidden="true"
          />
        </button>

        <input
          id={id}
          type="tel"
          inputMode="tel"
          autoComplete={autoComplete}
          required={required}
          value={localNumber}
          onChange={(e) => onLocalNumberChange(e.target.value)}
          placeholder={selectedCountry.example}
          aria-invalid={Boolean(error)}
          className="min-h-[44px] min-w-0 flex-1 bg-transparent px-3.5 text-sm text-[#ede6ca] outline-none placeholder:text-[#8d8a73] tabular-nums"
        />
      </div>

      {open && (
        <div
          className="absolute left-0 right-0 z-40 mt-1.5 rounded-[3px] border border-[#ede6ca]/28 bg-[#12160a] shadow-2xl overflow-hidden"
          role="presentation"
        >
          <div className="border-b border-[#ede6ca]/14 bg-[#171c0d] p-2">
            <label className="relative block">
              <Search
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[#c9c2a6]/70"
                aria-hidden="true"
              />
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value);
                  setHighlightIndex(0);
                }}
                onKeyDown={handleSearchKeyDown}
                placeholder="Search country name or +code…"
                aria-label="Search country codes"
                className="h-9 w-full rounded-[2px] border border-[#ede6ca]/20 bg-[#0e1208] pl-8 pr-3 text-xs text-[#ede6ca] outline-none placeholder:text-[#8d8a73] focus:border-[#ede6ca]"
              />
            </label>
          </div>

          <ul
            role="listbox"
            aria-label="Country dial codes"
            className="max-h-60 overflow-y-auto divide-y divide-[#ede6ca]/[0.06]"
          >
            {filteredCountries.length === 0 ? (
              <li className="px-3.5 py-3 text-xs text-[#c9c2a6]/75">
                No matching countries found.
              </li>
            ) : (
              filteredCountries.map((country, idx) => {
                const isSelected = country.iso2 === selectedCountry.iso2;
                const isHighlighted = idx === highlightIndex;
                return (
                  <li key={country.iso2} role="option" aria-selected={isSelected}>
                    <button
                      type="button"
                      onClick={() => handleSelect(country)}
                      className={`flex w-full min-h-[40px] items-center justify-between gap-2 px-3 py-2 text-left text-xs transition-colors cursor-pointer ${
                        isSelected
                          ? 'bg-[#a9b47e]/18 text-[#ede6ca]'
                          : isHighlighted
                            ? 'bg-[#ede6ca]/[0.08] text-[#ede6ca]'
                            : 'text-[#c9c2a6] hover:bg-[#ede6ca]/[0.06] hover:text-[#ede6ca]'
                      }`}
                    >
                      <span className="flex min-w-0 items-center gap-2.5">
                        <span className="text-base leading-none shrink-0" aria-hidden="true">
                          {country.flag}
                        </span>
                        <span className="truncate font-medium">{country.name}</span>
                      </span>
                      <span className="flex shrink-0 items-center gap-2 font-mono text-[11px] tabular-nums text-[#a9b47e]">
                        <span>{country.dialCode}</span>
                        {isSelected && <Check className="h-3.5 w-3.5" aria-hidden="true" />}
                      </span>
                    </button>
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {hint && !error && (
        <p className="mt-1.5 text-[11px] text-[#c9c2a6]/75">{hint}</p>
      )}
      {error && (
        <p role="alert" className="mt-1.5 text-xs text-rose-300">
          {error}
        </p>
      )}
    </div>
  );
}
