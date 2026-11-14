interface TbaTextProps {
  text?: string;
  className?: string;
}

/**
 * Renders placeholder "TBA" markers in italic Cormorant Garamond light moss
 * so every placeholder reads as an intentional editorial element.
 */
export function TbaText({ text = 'TBA', className = '' }: TbaTextProps) {
  return (
    <span className={`font-serif italic text-[#a9b47e] tracking-normal ${className}`}>
      {text}
    </span>
  );
}
