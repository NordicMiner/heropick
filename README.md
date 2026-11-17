# HeroPick

Finds your best event photos fast, on your iPhone, even with no signal.
Your photos never leave your phone.

## Put it on your iPhone

1. Open the HeroPick link in **Safari**.
2. Tap **Share** (the square with the arrow).
3. Tap **Add to Home Screen**, then **Add**.
4. Open HeroPick from your home screen **once while you have signal**.
5. Wait for the green dot: **Offline ready**. Now it works anywhere.

## Use it after an event

1. Send the photos from your camera to your phone, as you do now.
2. Open HeroPick and tap **Quick pick**.
3. Choose what you shot (for example **Government**), then **Choose photos** and select today's photos.
4. Wait while it checks them. You get **Your best 6**.
   - **More** or **Fewer** changes how many (4 to 10).
   - Tap a photo, then **Swap**, to pick a different one.
   - **Edit** sets brightness, contrast and a look for all of them.
5. Tap **Share**, then **Send**, and choose Slack.

If you leave HeroPick to post in Slack, your picks are still there when you come back.

## For developers

- `npm run dev` — local app
- `npm test` — unit tests (WebKit)
- `npm run e2e` — end-to-end tests
- `#tune` — desktop page to mark the photos you would have sent; `npm run eval -- <measurements.json> <picks.json>` compares them with the app's picks.

Real photos are never committed (`samples/` is ignored).

## Tested on

_Not yet tested on a real iPhone._
