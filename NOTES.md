# Vetriver — Trade Site (the Dreem-style brochure)

```bash
# it's one file, no build, no server
open index.html
```

---

## What this is, and why it's a different site

You asked for "a design like Dreem Fabrics." So first, what Dreem actually **is**:

> A Lovable-generated **brochure site**. No cart. No payments. No inventory.
> Every single call-to-action is a phone number or a WhatsApp link.
> Its entire job is: **get you to call Fathima Mam.**

That's a smart choice for them — fabric sells by touch, custom measurement and
conversation. A cart would actively get in the way.

But if I'd rebuilt your store in that shape, I'd have deleted your Razorpay
checkout, your live inventory and your admin dashboard. So this is a **second,
separate site**, not a replacement.

### The two sites do different jobs

| | `vetriver.in` (built earlier) | `vetriver.in/trade` (this) |
|---|---|---|
| **Sells to** | Retail — one garland, one buyer | **Bulk — tonnes, temples, hotels, distributors** |
| **Conversion** | Add to cart → Razorpay | **Call / WhatsApp** |
| **Palette** | Dark root-green (studio) | **Cream + green ink (daylight)** |
| **Inventory** | Live, server-backed | None — it's a brochure |

**This is your B2B front door.** Dreem sells by conversation because fabric needs
touch. Your equivalent isn't retail garlands — it's the *300 tonnes*. A guest house
buying 40 cooler pads, a temple ordering garlands monthly, an exporter wanting raw
root by the kilo: **none of those close on a checkout button.** They close on a call.

Note the range card at the bottom: **"Raw Root · Wholesale — by the kilo or by the
tonne."** That card doesn't exist on the retail site. It's the reason this one does.

---

## What I took from Dreem

Everything structural, because the structure is genuinely good:

- **Hero → Collections grid → Reviews → Visit us** — the exact spine
- **"Direct from our own warehouse. No middlemen."** → became your
  *"Straight from our own yard. No middlemen."* It's the same argument, and it's
  more true for you than it is for them: they have a Pune warehouse; **you have the farm.**
- **Star rating badge** up top, near the headline
- **Real-name testimonials** with a location and a "Local Guide"-style tag
- **Showroom block** — address, hours, a map, "Call to Order", "Our Guarantee"
- **Phone + WhatsApp as the only CTAs**, repeated everywhere
- **Sticky call bar on mobile** — Dreem doesn't have this; it's the single highest-
  impact addition. Most of your traffic is a phone, and the whole site is a call button.

## What I deliberately did *not* copy

**Dreem's cream-and-serif palette.** Two reasons:

1. It's the exact "warm cream + high-contrast serif" combination that every AI
   generates right now. You told me: *don't feel like an AI.*
2. If I'd matched it, your two sites would look like **two different companies.**

So this site is cream and airy — the daylight room, the opposite of the dark retail
store — but the **ink is your root-green**, not black, and the accent is your gold.
Green-on-cream instead of black-on-cream is a small decision that does a lot of work:
it's bright and inviting like Dreem, while staying unmistakably Vetriver. Same brand,
different light.

---

## The hero: why a number, not a room

Dreem's hero is a photograph of linen curtains in morning light. I don't have the
equivalent for you — **a real photo of vetiver hanging in a real room** — and
faking one is exactly the thing that would make this feel AI-made.

So the hero leads with the number instead: **"Three hundred tonnes of root, and
counting."** For a bulk buyer, that *is* the hook. It's the one thing you can say
that no reseller in India can.

When you have the photograph, it goes here and the number moves to the corner stamp.

---

## Before you launch this

**1. The reviews are placeholders — replace them.**
They're written in the right register (specific, plain, believable) but **they are
not real**, and there's a visible note on the page saying so. Fake reviews are
illegal under the Consumer Protection Act and they're the fastest way to lose trust.

Get real ones: Google Business Profile → ask ten actual customers. Dreem's whole
credibility rests on *31 real reviews*, and that is the part of their site you most
need to copy.

**2. Same photography problem as the retail site.**
Every image here is a re-crop of your packaging art, brightened. It holds together,
but the curtain, mat and pad especially need real shots. For this site specifically:
- **The drying yard.** The 300 tonnes. That photo *is* the whole pitch.
- Hands tying a garland
- A khus curtain, wet, hanging in a hot room

**3. Confirm the details I filled in**
- Hours: I put *Mon–Sat, 9:00–6:00* — correct it
- PIN: I used *624619* for Ottanchatharam in the schema — verify it
- The map is a generic Ottanchatharam embed — replace with your exact Google
  Business Profile pin once you've claimed it

**4. Decide where it lives**
- `vetriver.in/trade` — recommended, shares your domain authority
- or `vetriver.in` as the *front door*, with the shop at `/shop`, if bulk turns out
  to be the bigger business. You'll know within a quarter which way round it should be.

---

## Built in

- **LocalBusiness schema** (not Product) — right type for a brochure. Address,
  hours, phone, geo. This is what puts you in Google Maps and local search.
- **WhatsApp deep links are pre-filled per product** — tapping the oil card opens
  WhatsApp with *"I'm interested in ruh khus oil"* already typed. Removes the
  friction of the customer having to explain themselves.
- Sticky mobile call bar, one h1, alt text throughout, keyboard focus visible,
  reduced-motion respected, no horizontal overflow at 390px.
- Cards and quotes verified pixel-even; hero image square at both breakpoints.
