import { QoneMark } from "./QoneMark";

type QoneBrandProps = {
  withWordmark?: boolean;
  className?: string;
};

/**
 * The single pink square in the wordmark is the only brand colour on the
 * landing page. Everything else stays monochrome.
 */
export const QoneBrand = ({
  withWordmark = true,
  className = "",
}: QoneBrandProps) => {
  return (
    <a
      href="/"
      aria-label="qone, retour à l'accueil"
      className={`group inline-flex w-fit items-center gap-3 ${className}`}
    >
      <span className="grid size-10 place-items-center border border-line bg-panel text-fg transition-colors duration-300 group-hover:border-line-strong">
        <QoneMark className="size-6" />
      </span>

      {withWordmark ? (
        <span className="flex items-baseline gap-1 text-lg font-medium tracking-[-0.05em] text-fg">
          qone
          <span
            aria-hidden="true"
            className="size-1.5 translate-y-[-1px] bg-accent"
          />
        </span>
      ) : null}
    </a>
  );
};
