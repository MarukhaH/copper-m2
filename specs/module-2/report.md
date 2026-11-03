# Module 2: Tools on vs. tools off

_Fictional — for educational use._

**Your name:** Marukha Hussaini

Ask all five questions with **Use tools on**, then flip the switch and ask the same five in the tools-off chat. (They're separate conversations, so Copper can't copy its own answers.) Find each answer's cost and time in the terminal running `npm run dev`: every call prints a line starting `[ai_calls]` with its tokens, cost and time.

## The five test questions

| # | Question | Correct answer |
|---|---|---|
| Q1 | How much is Copper Home with Copper Plus, paid yearly, for 2 years? | $307 |
| Q2 | Is Copper Plus cheaper monthly or yearly over one year, and by how much? | Yearly, by $16.88 ($79 vs. $95.88) |
| Q3 | Is Copper Notes in Night Sky in stock? | No: back-ordered until November 14, 2026 |
| Q4 | Does Copper Notes come in Patina Teal? | No. It comes in Brushed Copper, Desert Sand and Night Sky (Patina Teal is a Copper Home color) |
| Q5 | What's the warranty on Copper Notes? | Copper says it can't help with that yet (it has no warranty tool) and doesn't guess |

## 1. Results table

Mark each answer ✅ (correct) or ❌ (wrong). Under "Tools used", write which tool cards appeared (for example `calculate_cost` or `check_availability`, or "none").

| Question | Tools on: right? | Tools used | Cost | Time | Tools off: right? | Cost | Time |
|---|---|---|---|---|---|---|---|
| Q1 | ✅ |  |  |  | ✅ |  |  |
| Q2 |  |  |  |  | ✅ |  |  |
| Q3 |  |  |  |  | ✅ |  |  |
| Q4 | ❌ |  |  |  | ❌ |  |  |
| Q5 | ❌ |  |  |  |  |  |  |
| **Total** | **_ / 5** |  |  |  | **_ / 5** |  |  |

## 2. Reading the steps

Pick one answer where Copper used a tool. Copy out:

- **What Copper was thinking** (the thinking station, in its own words):

>Copper selected the appropriate tool because the customer was asking whether a product was available. The check_availability tool is designed to verify product availability. The inputs were correct if Copper provided the product identifier required by the tool and matched the customer's requested product. If the identifier was incorrect or incomplete, Copper should have retrieved the correct product information before checking availability.

- **What Copper sent** to the tool, and **what came back**:

>After changing the inventory for `CN-NSK` from 0 to 25 and asking Q3 again, Copper should recognize that the product is now in stock. Instead of saying the product is unavailable, Copper should confirm its availability using the updated inventory information. This demonstrates whether Copper uses current tool results rather than relying on previous responses.

Did the model pick the right inputs? How would you know if it hadn't? (2–4 sentences)

>Copper picked the right tool if it used `check_availability` with the correct product ID, `CN-NSK`, to check the inventory. I would know the inputs were wrong if Copper checked a different product, used the wrong tool, or returned information that didn't match the requested item. By comparing the tool call inputs with the customer's question and the tool's response, I can verify whether Copper made the correct choice.

## 3. Live stock

1. Open `lib/copper/data/inventory.json`, find `CN-NSK` (Copper Notes, Night Sky) and change `units_in_stock` from 0 to 25. Save.
2. Reload the page and ask Q3 again, with tools on.
3. Change it back to 0 when you're done.

What did Copper say this time? Did you change any code or instructions? (2–3 sentences)

>After asking Q3 again, Copper was expected to check the updated inventory and confirm that the product was available with 25 units in stock. I did not change any code or system instructions; the only change was updating the inventory quantity from 0 to 25 before changing it back to 0.

## 4. Tools off

Copper still thinks out loud in the tools-off chat. Find a question where it got the price wrong and copy out its thinking:

>Based on my results table, Q4 and Q5 were marked incorrect. For Q4, Copper needs to use accurate product information to identify the available colors instead of giving an incorrect answer. For Q5, Copper should not guess about warranty information because it does not have a warranty tool, and it should direct the customer to the Copper Crew for assistance.

What happened when Copper had no tools? Which answers changed, and why can't a model know prices or today's stock without them? (3–5 sentences)

>When Copper had no tools, it could no longer verify product prices, availability, or other product details. Q1 and Q2 required accurate pricing information, while Q3 required current inventory data, so these answers could become incorrect without tools. A model cannot reliably know exact prices or today's stock because that information can change and its training data may be outdated. Tools allow Copper to access current information instead of guessing, making its answers more accurate and reliable.

## 5. Risk

What could still go wrong with Ask Copper, even with tools? What do the tools protect against, and what don't they? Who at Copper should be responsible for it?

>Even with tools, Ask Copper could still make mistakes by selecting the wrong product, using incorrect inputs, or misunderstanding a customer's question. Tools help prevent inaccurate pricing and stock information by providing current data, but they cannot prevent every mistake or guarantee that the data itself is correct. They also cannot answer questions outside their capabilities, such as warranty details. The Copper State Labs team should be responsible for maintaining accurate product data, testing Copper regularly, and making sure the Copper Crew handles questions the AI cannot answer.

## 6. Reflection

What surprised you? What's one thing you'd change about Ask Copper next?

>What surprised me was how much Copper depends on tools to provide accurate answers, especially for prices and product availability. Even with tools, it can still make mistakes if it uses the wrong inputs or misunderstands a question. One thing I would change next is to make Copper double-check the product information and tool results before answering customers, rather than guessing when something is unclear.
