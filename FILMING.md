# Filming Tanner and Jade

The stream switches between short clips of one couch, filmed from one camera that never moves. The words are written live and spoken by computer voice, so the clips only need to *look* like talking. Nobody needs to learn lines.

## What you need

- Two adults who agree in writing to appear as Tanner and Jade, knowing an AI will put vulgar words in their characters' mouths. Keep that consent.
- A phone on a tripod (any modern phone is fine), a couch, a lamp or two.
- About an hour.

## Set up once, then never touch it

1. **Camera:** landscape, 1080p, 30 fps. Lock exposure and focus (long-press the screen on iPhone). Turn off stabilization if you can.
2. **Frame:** both people on the couch, from mid-chest up, Tanner on the left, Jade on the right, with some room above their heads. Match the drawn scene: shoot it waist-high, about 2 m away.
3. **Light:** one warm lamp to the side and the TV or a monitor in front for a blue glow. A pink LED strip on the wall behind them sells the vibe. Avoid windows; daylight changes between takes.
4. **Wardrobe:** Tanner in a grey tank top, backwards red cap, gold chain, energy drink in hand. Jade in a dark hoodie, gold hoops, phone in hand. Same outfit, props and positions in every take.
5. **Don't move the camera, couch or lamps** until every clip is done. If anything shifts, cuts between clips will jump.

## The clips

Each clip is **6 to 10 seconds**, starts and ends in a similar neutral position (so it loops cleanly), and has **no real talking audio needed** (the site plays clips muted).

| File | Who talks | What to do |
|---|---|---|
| `idle.mp4` | nobody | Both sit, glance at the camera, at each other, at a phone. Small movements, natural breathing. |
| `idle-2.mp4`, `idle-3.mp4` | nobody | More of the same with different business: Tanner sips his drink, Jade scrolls, someone laughs quietly. More idle takes means less obvious looping. |
| `tanner.mp4` | Tanner | Tanner talks to the camera with his hands. Jade listens, rolls her eyes, looks at him. Mouth: say anything, like counting or reading a menu; nobody hears it. |
| `jade.mp4` | Jade | Jade talks, deadpan, maybe pointing at the camera. Tanner reacts to her. |

Optional mood takes, used when the line has that mood (they fall back to the general take otherwise):

| Mood | Tanner | Jade |
|---|---|---|
| `angry` | `tanner-angry.mp4`: leans in, points, outraged | `jade-angry.mp4`: shoves Tanner, glares |
| `happy` | `tanner-happy.mp4`: laughing hard, slapping his knee | `jade-happy.mp4`: laughing at him |
| `shocked` | `tanner-shocked.mp4`: leans back, hands on head | `jade-shocked.mp4`: jaw drop, covers mouth |
| `smug` | `tanner-smug.mp4`: flexes, grins | `jade-smug.mp4`: slow head shake, side-eye |
| `sad` | `tanner-sad.mp4`: head in hands | `jade-sad.mp4`: fake sympathetic pout |

Extra takes of anything get a number: `tanner-angry-2.mp4`, `jade-3.mp4`. The site picks one at random each time.

## Tips that make it look live

- **Talk fast and keep moving.** Mouths don't match the words exactly, so busy mouths and hands hide that better than slow, careful speech.
- **Keep it loose.** Real streams have people shifting, scratching, checking phones. Stiff takes look like a loop.
- **Same start and end pose** in every clip, roughly, so cuts look like a camera that's just been running.
- **Trim** the start and end where someone reaches for the record button.

## Put them on the site

1. Export as `.mp4` (H.264). Keep each under about 10 MB; phones' default "most compatible" setting is fine.
2. Name them exactly as above, all lowercase.
3. Put them in `public/scene/`.
4. Reload the page. As soon as there's at least one `idle` clip and one clip each for Tanner and Jade, the stream switches from the drawing to your footage.

To check what the site found, open `http://localhost:3000/api/scene`.
