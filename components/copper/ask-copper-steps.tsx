// How one Ask Copper answer is drawn: a rail of stations (the tools Copper can
// use, its thinking, each tool call, what's happening now) and then the reply.
// The panel in ask-copper.tsx owns the chat; this file only draws a Progress.
import type { ReactNode } from "react";
import {
  BrainIcon,
  MessageCircleIcon,
  TriangleAlertIcon,
  WrenchIcon,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
import { formatUsd, getProducts } from "@/lib/copper/catalog";
import {
  TOOL_LABELS,
  type Progress,
  type ToolStep,
} from "@/lib/copper/assistant/progress";
import { cn } from "@/lib/utils";

type Tone = "copper" | "teal" | "sunset";

const NODE_TONE: Record<Tone, string> = {
  copper: "bg-primary text-primary-foreground",
  teal: "bg-accent text-accent-foreground",
  sunset: "bg-chart-3 text-primary-foreground",
};

/** One stop on the rail: a round node with an icon, ringed in the body color. */
function Station({
  icon,
  tone,
  label,
  children,
}: {
  icon: ReactNode;
  tone: Tone;
  label?: string;
  children?: ReactNode;
}) {
  return (
    <div className="relative pb-5 pl-9">
      <span
        className={cn(
          "ring-secondary absolute top-0 left-0 flex size-6 items-center justify-center rounded-full ring-4",
          NODE_TONE[tone],
        )}
      >
        {icon}
      </span>
      {label && (
        <p className="text-muted-foreground mb-1.5 text-[0.7rem] font-bold tracking-widest uppercase">
          {label}
        </p>
      )}
      {children}
    </div>
  );
}

/** Renders the **bold** and `code` marks in a thought summary. */
function Markdown({ text }: { text: string }) {
  return text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, index) => {
    if (part.startsWith("**") && part.endsWith("**"))
      return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("`") && part.endsWith("`"))
      return (
        <code key={index} className="font-mono text-[0.85em]">
          {part.slice(1, -1)}
        </code>
      );
    return <span key={index}>{part}</span>;
  });
}

// ---------------------------------------------------------------------------
// Tool cards
// ---------------------------------------------------------------------------

type Row = [label: string, value: string];

const productName = (id: unknown) =>
  getProducts().find((p) => p.id === id)?.name ?? String(id);

const planName = (id: unknown) =>
  id === "copper-plus" ? "Copper Plus" : "Free";

/** What Copper sent, as labelled rows, never raw JSON. */
function inputRows(name: string, input: unknown): Row[] {
  const data = (input ?? {}) as Record<string, unknown>;
  if (name === "calculate_cost")
    return [
      [
        "Products",
        Array.isArray(data.products) && data.products.length > 0
          ? data.products.map(productName).join(", ")
          : "None",
      ],
      ["Plan", planName(data.plan)],
      ["Billing", String(data.billing)],
      ["Years", String(data.years)],
    ];
  if (name === "check_availability")
    return [
      ["Product", productName(data.product)],
      ["Color", data.color ? String(data.color) : "All colors"],
    ];
  return [];
}

const EMPTY_INPUT: Record<string, string> = {
  get_prices: "Nothing, it just asked for the price list",
  get_products: "Nothing, it just asked what Copper sells",
};

const STOCK_PILL = {
  in_stock: { text: "In stock", className: "bg-accent text-accent-foreground" },
  low_stock: {
    text: "Low stock",
    className: "bg-chart-4 text-primary-foreground",
  },
  backordered: {
    text: "Back-ordered",
    className: "bg-chart-3 text-primary-foreground",
  },
} as const;

const dateLabel = (iso: string) =>
  new Date(`${iso}T12:00:00`).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });

type Out = Record<string, unknown> & {
  lines?: { item: string; usd: number }[];
  totalUsd?: number;
  products?: Record<string, unknown>[];
  plans?: { name: string; monthlyUsd: number; annualUsd: number }[];
  colors?: unknown[];
  status?: string;
  message?: string;
  color?: string;
};

/** What came back, drawn for each tool. */
function Output({ step }: { step: ToolStep }) {
  if (step.state === "error")
    return (
      <p className="text-sm">{String(step.output ?? "That didn't work.")}</p>
    );
  const out = (step.output ?? {}) as Out;

  if (step.name === "calculate_cost")
    return (
      <div className="flex flex-col gap-1 text-sm">
        {out.lines?.map((line) => (
          <div key={line.item} className="flex justify-between gap-4">
            <span>{line.item}</span>
            <span>{formatUsd2(line.usd)}</span>
          </div>
        ))}
        <div className="border-accent/40 mt-1 flex items-baseline justify-between border-t pt-2">
          <span className="font-semibold">Total</span>
          <span className="text-primary text-xl font-bold">
            {formatUsd2(out.totalUsd ?? 0)}
          </span>
        </div>
      </div>
    );

  if (step.name === "get_products")
    return (
      <div className="flex flex-col gap-3 text-sm">
        {out.products?.map((p) => (
          <div key={String(p.id)}>
            <div className="flex justify-between gap-4 font-semibold">
              <span>{String(p.name)}</span>
              <span>{formatUsd(Number(p.priceUsd))}</span>
            </div>
            <p className="text-muted-foreground text-xs">{String(p.type)}</p>
            <div className="mt-1 flex flex-wrap gap-1">
              {(p.colors as string[]).map((color) => (
                <Badge
                  key={color}
                  className="bg-accent text-accent-foreground h-auto px-2 py-0.5 text-xs"
                >
                  {color}
                </Badge>
              ))}
            </div>
          </div>
        ))}
      </div>
    );

  if (step.name === "get_prices")
    return (
      <div className="flex flex-col gap-1 text-sm">
        {out.products?.map((p) => (
          <div key={String(p.id)} className="flex justify-between gap-4">
            <span>{String(p.name)}</span>
            <span>{formatUsd(Number(p.priceUsd))}</span>
          </div>
        ))}
        {out.plans
          ?.filter((plan) => plan.monthlyUsd > 0)
          .map((plan) => (
            <div key={plan.name} className="flex justify-between gap-4">
              <span>{plan.name}</span>
              <span>
                {formatUsd(plan.monthlyUsd)}/mo · {formatUsd(plan.annualUsd)}/yr
              </span>
            </div>
          ))}
      </div>
    );

  if (step.name === "check_availability") {
    if (out.status === "not_a_color")
      return (
        <p className="text-sm">
          {String(out.product)} doesn&apos;t come in {String(out.color)}. It
          comes in {(out.colors as string[]).join(", ")}.
        </p>
      );
    if (out.status === "unavailable")
      return <p className="text-sm">{out.message}</p>;
    return (
      <div className="flex flex-col gap-1.5 text-sm">
        {(
          out.colors as {
            color: string;
            stock: keyof typeof STOCK_PILL;
            restockDate: string | null;
          }[]
        )?.map((row) => (
          <div
            key={row.color}
            className="flex items-center justify-between gap-4"
          >
            <span>{row.color}</span>
            <span
              className={cn(
                "rounded-full px-2 py-0.5 text-xs font-semibold",
                STOCK_PILL[row.stock].className,
              )}
            >
              {STOCK_PILL[row.stock].text}
              {row.restockDate && ` until ${dateLabel(row.restockDate)}`}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return <p className="text-sm">{JSON.stringify(step.output)}</p>;
}

/** "$149.00": the tool card shows whole cents so the lines line up. */
const formatUsd2 = (usd: number) => `$${usd.toFixed(2)}`;

function ToolCard({ step, number }: { step: ToolStep; number: number }) {
  const running = step.state === "calling";
  const rows = inputRows(step.name, step.input);
  return (
    <div
      data-testid="tool-call"
      data-tool={step.name}
      className="bg-card text-card-foreground overflow-hidden rounded-lg border"
    >
      <div className="bg-accent text-accent-foreground flex flex-wrap items-center gap-2 px-3 py-2">
        <span className="font-mono text-sm font-bold">{step.name}()</span>
        <span className="bg-background/30 rounded-full px-2 text-xs">
          tool {number}
        </span>
        <span className="ml-auto text-xs">
          {TOOL_LABELS[step.name] ?? step.name}
        </span>
      </div>
      <div className="px-3 py-2">
        <p className="text-muted-foreground mb-1 text-[0.7rem] font-bold tracking-widest uppercase">
          → What Copper sent
        </p>
        {step.input === undefined ? (
          <p className="text-muted-foreground text-sm italic">
            filling in the details…
          </p>
        ) : rows.length === 0 ? (
          <p className="text-sm">{EMPTY_INPUT[step.name]}</p>
        ) : (
          <dl className="grid grid-cols-[5rem_1fr] gap-x-3 gap-y-0.5 text-sm">
            {rows.map(([label, value]) => (
              <div key={label} className="contents">
                <dt className="text-muted-foreground">{label}</dt>
                <dd>{value}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>
      <div className="bg-accent/10 border-t px-3 py-2">
        <p className="text-muted-foreground mb-1 text-[0.7rem] font-bold tracking-widest uppercase">
          ← What came back
        </p>
        {running ? (
          <p className="text-muted-foreground flex items-center gap-2 text-sm">
            <Spinner className="size-3.5" />
            the app is running the code…
          </p>
        ) : (
          <Output step={step} />
        )}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// One answer
// ---------------------------------------------------------------------------

function nowDoing(progress: Progress, useTools: boolean) {
  if (progress.reply) return "Writing the answer…";
  if (progress.steps.length > 0) return "Deciding what to do next…";
  return useTools ? "Reading your question…" : "Answering from memory…";
}

export function Answer({
  progress,
  useTools,
}: {
  progress: Progress;
  useTools: boolean;
}) {
  const working = progress.status === "working";
  const used = new Set(
    progress.steps.flatMap((step) => (step.type === "tool" ? [step.name] : [])),
  );
  const names = Object.keys(TOOL_LABELS);
  const railTone: Tone = useTools ? "copper" : "sunset";

  return (
    <div className="flex flex-col">
      <div className="relative">
        <div
          aria-hidden
          className={cn(
            "absolute top-3 bottom-0 left-3 w-0.5 -translate-x-1/2 rounded-full bg-gradient-to-b",
            useTools
              ? "from-primary via-accent to-accent"
              : "from-chart-3 to-chart-3",
          )}
        />

        <Station
          tone={railTone}
          icon={<WrenchIcon className="size-3" />}
          label={
            useTools ? "Tools Copper can use" : "Tools given to Copper: none"
          }
        >
          <div className="flex flex-wrap gap-1.5">
            {names.map((name) => (
              <span
                key={name}
                className={cn(
                  "rounded-full px-2 py-0.5 font-mono text-xs",
                  !useTools && "text-muted-foreground line-through",
                  useTools && used.has(name)
                    ? "bg-accent text-accent-foreground font-bold"
                    : "bg-muted text-muted-foreground",
                )}
              >
                {name}
              </span>
            ))}
          </div>
          {!useTools && (
            <p className="text-muted-foreground mt-1.5 text-sm">
              Copper has to answer from memory alone.
            </p>
          )}
        </Station>

        {progress.steps.map((step, index) => {
          if (step.type === "thinking")
            return (
              <Station
                key={index}
                tone={useTools ? "copper" : "sunset"}
                icon={<BrainIcon className="size-3" />}
                label="Copper is thinking"
              >
                <div
                  data-testid="thinking"
                  className="text-muted-foreground border-l-2 pl-3 text-sm whitespace-pre-wrap italic"
                >
                  <Markdown text={step.text.trim()} />
                </div>
              </Station>
            );
          const toolNumber =
            progress.steps.slice(0, index).filter((s) => s.type === "tool")
              .length + 1;
          return (
            <Station
              key={step.id}
              tone="teal"
              icon={<WrenchIcon className="size-3" />}
              label={
                step.state === "calling"
                  ? "Copper is calling a tool"
                  : "Copper called a tool"
              }
            >
              <ToolCard step={step} number={toolNumber} />
            </Station>
          );
        })}

        {working && (
          <Station
            tone={railTone}
            icon={
              <span className="flex gap-0.5" aria-hidden>
                {[0, 150, 300].map((delay) => (
                  <span
                    key={delay}
                    className="size-1 animate-bounce rounded-full bg-current"
                    style={{ animationDelay: `${delay}ms` }}
                  />
                ))}
              </span>
            }
          >
            <p className="text-muted-foreground text-sm">
              {nowDoing(progress, useTools)}
            </p>
          </Station>
        )}
      </div>

      {progress.reply && (
        <div className="bg-card text-card-foreground mt-1 rounded-xl rounded-tl-sm border p-3">
          <p className="text-primary mb-1 flex items-center gap-1 text-xs font-bold">
            <MessageCircleIcon className="size-3" /> Copper
          </p>
          {!useTools && (
            <div className="border-chart-3 mb-2 rounded-lg border p-2 text-sm">
              <p className="flex items-center gap-1 font-bold">
                <TriangleAlertIcon className="size-4" /> Answered without tools:
                may be made up
              </p>
              <p className="text-muted-foreground mt-1">
                With tools off, Copper can&apos;t see today&apos;s prices or
                stock. The AI only has what it learned in training, so it fills
                the gaps with guesses that sound right. That&apos;s a
                hallucination.
              </p>
            </div>
          )}
          <p className="whitespace-pre-wrap">
            {progress.reply}
            {working && (
              <span
                aria-hidden
                className="bg-primary ml-0.5 inline-block h-4 w-0.5 animate-pulse align-middle"
              />
            )}
          </p>
        </div>
      )}
    </div>
  );
}
