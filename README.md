# Hourglass Timer for Dogs

A vanilla HTML, CSS, and JavaScript prototype that simulates a physical hourglass as a calm visual cue for a dog's owner's absence.

## Run locally

No build step or dependency installation is required.

1. Open a terminal in this directory.
2. Start any local static server, for example:

   ```sh
   python3 -m http.server 8000
   ```

3. Visit <http://localhost:8000> in a browser.

The app also works by opening `index.html` directly, although a local server is recommended for consistent browser behavior.

## Use the prototype

1. Choose 1–16 hours with the slider. Durations from 1–3 hours select the small glass, 4–9 hours select the medium glass, and 10–16 hours select the large glass.
2. Press **Start** above the selected glass. In normal mode, the countdown runs for the actual selected duration.
3. During the countdown, the upper sand decreases as the lower sand increases and the indicator is blue.
4. When the countdown ends, the lower chamber is full, the indicator becomes yellow, and a short tone plays. A second tone plays 30 seconds later unless the glass is reset.
5. Press **Stop / Reset** at any time to cancel the countdown and pending second tone, clear all sand, turn off the completion light, and return the slider to 1 hour.

## Demo Mode

Enable **Demo Mode** before pressing Start to preview a complete session in 24 seconds. Its second completion tone follows 3 seconds after the first so both notifications can be tested quickly. Demo Mode is explicitly separate from normal mode: it never changes the selected duration or the real-time behavior of a normal session.

This is a design prototype, not a proven treatment or IoT product. It has not been proven to reduce stress in dogs.
