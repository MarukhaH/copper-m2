"use server";

// Module 2: the server action the Ask Copper chat calls. It streams the
// conversation to the model through callStream (lib/ai/call.ts), with or
// without the tools, and sends back each step as it happens, so the panel can
// show Copper thinking and using its tools. The contract is in
// specs/module-2/spec.md.
import { stepCountIs } from "ai";
import { callStream, THOUGHT_SUMMARIES } from "@/lib/ai/call";
import { createLive, type Live } from "@/lib/ai/live";
import { COPPER_INSTRUCTIONS } from "@/lib/copper/assistant/instructions";
import type { Progress, Step } from "@/lib/copper/assistant/progress";
import { copperTools } from "@/lib/copper/assistant/tools";

export type ChatMessage = { role: "user" | "assistant"; content: string };

export type AskCopperRequest = {
  messages: ChatMessage[];
  useTools: boolean;
};

export type AskCopperResult = { progress: Live<Progress> };

/** At most this many model steps (tool calls plus the reply) per question. */
const MAX_STEPS = 5;

const APOLOGY = "Sorry, I couldn't answer that just now. Please try again.";

export async function askCopper(
  request: AskCopperRequest,
): Promise<AskCopperResult> {
  const { live, update, done } = createLive<Progress>();

  const steps: Step[] = [];
  let reply = "";

  // A fresh copy every time, so earlier updates never change underneath the
  // panel (or the tests) that are holding on to them.
  const snapshot = (status: Progress["status"]): Progress => ({
    steps: steps.map((step) => ({ ...step })),
    reply,
    status,
  });

  const toolStep = (id: string) =>
    steps.find((step) => step.type === "tool" && step.id === id);

  // Read the stream in the background, so the panel gets its first update
  // straight away instead of waiting for the whole answer.
  void (async () => {
    try {
      const messages = request.messages.map(({ role, content }) => ({
        role,
        content,
      }));
      // With tools off the model gets only the conversation: no instructions
      // and no tools, so it answers from memory alone.
      const result = callStream(
        { module: 2, feature: "ask-copper" },
        {
          messages,
          providerOptions: THOUGHT_SUMMARIES,
          ...(request.useTools
            ? {
                instructions: COPPER_INSTRUCTIONS,
                tools: copperTools,
                stopWhen: stepCountIs(MAX_STEPS),
              }
            : {}),
        },
      );

      update(snapshot("working"));
      let failed = false;

      for await (const part of result.fullStream) {
        if (part.type === "reasoning-delta") {
          const last = steps[steps.length - 1];
          if (last?.type === "thinking") last.text += part.text;
          else steps.push({ type: "thinking", text: part.text });
        } else if (part.type === "tool-input-start") {
          steps.push({
            type: "tool",
            id: part.id,
            name: part.toolName,
            state: "calling",
          });
        } else if (part.type === "tool-call") {
          const step = toolStep(part.toolCallId);
          if (step?.type === "tool") step.input = part.input;
          else
            steps.push({
              type: "tool",
              id: part.toolCallId,
              name: part.toolName,
              state: "calling",
              input: part.input,
            });
        } else if (part.type === "tool-result") {
          const step = toolStep(part.toolCallId);
          if (step?.type === "tool") {
            step.output = part.output;
            step.state = "done";
          }
        } else if (part.type === "tool-error") {
          const step = toolStep(part.toolCallId);
          if (step?.type === "tool") {
            step.output =
              part.error instanceof Error
                ? part.error.message
                : String(part.error);
            step.state = "error";
          }
        } else if (part.type === "text-delta") {
          reply += part.text;
        } else if (part.type === "error") {
          failed = true;
          continue;
        } else {
          continue;
        }
        update(snapshot("working"));
      }

      if (failed) {
        if (reply === "") reply = APOLOGY;
        done(snapshot("error"));
        return;
      }
      // The stream ended normally but said nothing: still a finished answer.
      if (reply === "") reply = APOLOGY;
      done(snapshot("done"));
    } catch {
      if (reply === "") reply = APOLOGY;
      done(snapshot("error"));
    }
  })();

  return { progress: live };
}
