import Image from "next/image";

export function HomePhoto({
  src,
  alt,
  preload,
  objectPosition = "center",
}: {
  src: string;
  alt: string;
  preload?: boolean;
  objectPosition?: string;
}) {
  return (
    <Image
      src={src}
      alt={alt}
      fill
      preload={preload}
      sizes="100vw"
      className="object-cover"
      style={{ objectPosition }}
    />
  );
}
