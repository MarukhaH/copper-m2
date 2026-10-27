"use client";

// Ask Copper: the floating chat panel. Tools on and tools off are two separate
// conversations, so the tools-off model never sees an answer the tools worked
// out. Each answer streams in from askCopper() and is drawn by <Answer />.
import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { ArrowUpIcon, MessageCircleIcon } from "lucide-react";
import { Answer } from "@/components/copper/ask-copper-steps";
import { SetupRequired } from "@/components/setup-required";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetTitle,
} from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { readLive } from "@/lib/ai/live";
import { askCopper, type ChatMessage } from "@/lib/copper/assistant/ask";
import type { Progress } from "@/lib/copper/assistant/progress";

const STARTERS = [
  "How much is Copper Home with Copper Plus, paid yearly, for 2 years?",
  "Is Copper Notes in Night Sky in stock?",
  "Is Copper Plus cheaper monthly or yearly?",
];

type Turn = { question: string; progress: Progress | null };
type Chats = { tools: Turn[]; noTools: Turn[] };

const EMPTY: Progress = { steps: [], reply: "", status: "working" };

export function AskCopper({ aiConfigured }: { aiConfigured: boolean }) {
  const [open, setOpen] = useState(false);
  const [useTools, setUseTools] = useState(true);
  const [chats, setChats] = useState<Chats>({ tools: [], noTools: [] });
  const [draft, setDraft] = useState("");
  const bodyRef = useRef<HTMLDivElement>(null);

  // Open from /#ask, and from any "Ask Copper" link. A click is listened for
  // as well as hashchange, because clicking a link to the address you're
  // already at fires no hashchange.
  useEffect(() => {
    const onHash = () => window.location.hash === "#ask" && setOpen(true);
    const onClick = (event: MouseEvent) => {
      const link = (event.target as Element).closest?.('a[href$="#ask"]');
      if (link) {
        event.preventDefault();
        setOpen(true);
      }
    };
    // Loading the site at /#ask opens it too (after the first render, so the
    // server and browser draw the same thing first).
    const initial = window.setTimeout(onHash, 0);
    window.addEventListener("hashchange", onHash);
    document.addEventListener("click", onClick);
    return () => {
      window.clearTimeout(initial);
      window.removeEventListener("hashchange", onHash);
      document.removeEventListener("click", onClick);
    };
  }, []);

  const key = useTools ? "tools" : "noTools";
  const turns = chats[key];
  const streaming = turns.some((turn) => turn.progress?.status === "working");

  // Keep the newest step in view as the answer streams in.
  useEffect(() => {
    const body = bodyRef.current;
    if (body) body.scrollTop = body.scrollHeight;
  }, [turns]);

  const send = useCallback(
    async (question: string) => {
      const text = question.trim();
      if (!text || streaming) return;
      const mode = useTools ? "tools" : "noTools";
      const history = chats[mode];

      // Only finished questions and replies go to the model: no steps or tool data.
      const messages: ChatMessage[] = [
        ...history.flatMap((turn): ChatMessage[] => [
          { role: "user", content: turn.question },
          ...(turn.progress?.reply
            ? [{ role: "assistant" as const, content: turn.progress.reply }]
            : []),
        ]),
        { role: "user", content: text },
      ];
      const index = history.length;

      const show = (progress: Progress) =>
        setChats((current) => ({
          ...current,
          [mode]: current[mode].map((turn, i) =>
            i === index ? { ...turn, progress } : turn,
          ),
        }));

      setDraft("");
      setChats((current) => ({
        ...current,
        [mode]: [...current[mode], { question: text, progress: EMPTY }],
      }));

      try {
        const { progress } = await askCopper({ messages, useTools });
        for await (const update of readLive(progress)) show(update);
      } catch {
        show({
          steps: [],
          reply: "Sorry, I couldn't answer that just now. Please try again.",
          status: "error",
        });
      }
    },
    [chats, streaming, useTools],
  );

  return (
    <>
      <Button
        data-testid="ask-copper-launcher"
        aria-label="Ask Copper"
        onClick={() => setOpen(true)}
        className="fixed right-4 bottom-4 z-40 h-12 gap-2 rounded-full px-5 shadow-lg"
      >
        <MessageCircleIcon />
        Ask Copper
      </Button>

      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent
          data-testid="ask-copper"
          showCloseButton={false}
          className="w-full gap-0 p-0 data-[side=right]:w-full data-[side=right]:sm:max-w-md"
        >
          <header className="bg-[#1c2333] text-[#efe3d0]">
            <div className="flex items-center gap-3 p-4">
              <span className="bg-primary flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full">
                <Image
                  src="/assets/brand/copper-mascot.png"
                  alt="Copper, the robot mascot"
                  width={40}
                  height={40}
                  className="size-10 object-cover"
                />
              </span>
              <div className="min-w-0 flex-1">
                <SheetTitle className="text-lg font-bold text-[#efe3d0]">
                  Ask Copper
                </SheetTitle>
                <SheetDescription className="text-sm text-[#efe3d0]/80">
                  Prices, totals and stock, checked with tools.
                </SheetDescription>
              </div>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => setOpen(false)}
                className="text-[#efe3d0] hover:bg-white/10 hover:text-[#efe3d0]"
              >
                ✕
              </Button>
            </div>
            <div className="flex items-center justify-between gap-3 bg-white/5 px-4 py-2">
              <span className="text-sm font-semibold">Use tools</span>
              <span className="text-xs text-[#efe3d0]/80">
                {useTools ? "Checks every answer" : "Model guesses alone"}
              </span>
              <Switch
                aria-label="Use tools"
                checked={useTools}
                onCheckedChange={setUseTools}
              />
            </div>
          </header>

          {!aiConfigured ? (
            <div className="bg-secondary flex-1 overflow-y-auto px-4">
              <SetupRequired service="ai" />
            </div>
          ) : (
            <>
              <div
                ref={bodyRef}
                className="bg-secondary text-secondary-foreground flex-1 overflow-y-auto p-4"
              >
                <div className="flex flex-col gap-5">
                  {turns.length === 0 && (
                    <p className="text-muted-foreground text-sm">
                      Ask about Copper prices, totals or stock.
                    </p>
                  )}
                  {turns.map((turn, index) => (
                    <div key={index} className="flex flex-col gap-3">
                      <p className="bg-primary text-primary-foreground self-end rounded-xl rounded-tr-sm px-3 py-2">
                        {turn.question}
                      </p>
                      {turn.progress && (
                        <Answer progress={turn.progress} useTools={useTools} />
                      )}
                    </div>
                  ))}
                  {!streaming && (
                    <div className="flex flex-col items-start gap-2">
                      {STARTERS.map((starter) => (
                        <Button
                          key={starter}
                          variant="outline"
                          onClick={() => send(starter)}
                          className="h-auto max-w-full text-left whitespace-normal"
                        >
                          {starter}
                        </Button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <form
                onSubmit={(event) => {
                  event.preventDefault();
                  void send(draft);
                }}
                className="bg-background flex items-center gap-2 border-t p-3"
              >
                <input
                  aria-label="Your question"
                  value={draft}
                  onChange={(event) => setDraft(event.target.value)}
                  placeholder="Ask about a price or stock…"
                  className="border-input bg-background focus-visible:ring-ring/50 h-10 min-w-0 flex-1 rounded-full border px-4 text-sm outline-none focus-visible:ring-3"
                />
                <Button
                  type="submit"
                  aria-label="Send"
                  size="icon-lg"
                  disabled={streaming}
                  className="size-10 rounded-full"
                >
                  <ArrowUpIcon />
                </Button>
              </form>
            </>
          )}
        </SheetContent>
      </Sheet>
    </>
  );
}
