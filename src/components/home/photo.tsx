import Image from "next/image";

export function HomePhoto({
  src,
  alt,
  preload,
  objectPosition = "center",
  className,
}: {
  src: string;
  alt: string;
  preload?: boolean;
  objectPosition?: string;
  className?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      preload={preload}
      sizes="100vw"
      className={className ? `object-cover ${className}` : "object-cover"}
      style={{ objectPosition }}
    />
  );
}
