/**
 * input.js
 * -----------------------------------------------------------------------
 * Touch controls, but as SCREEN ZONES instead of discrete buttons:
 *   - left half of the canvas held down  -> brake
 *   - right half of the canvas held down -> accelerate
 *
 * Multi-touch aware: each active touch point is checked independently
 * against the midline, so e.g. resting a thumb on the right side while
 * briefly tapping the left still registers both correctly. Holding
 * continues to apply force every frame for as long as the zone is held
 * (per spec — no "tap = instant velocity change").
 * -----------------------------------------------------------------------
 */

const Input = {
    accelerate: false,
    brake: false,

    init(canvas) {
        const self = this;

        function evaluateTouches(touchList) {
            const rect = canvas.getBoundingClientRect();
            let acc = false;
            let brk = false;
            for (let i = 0; i < touchList.length; i++) {
                const localX = touchList[i].clientX - rect.left;
                if (localX < rect.width / 2) brk = true;
                else acc = true;
            }
            self.accelerate = acc;
            self.brake = brk;
        }

        canvas.addEventListener('touchstart', (e) => evaluateTouches(e.touches), { passive: true });
        canvas.addEventListener('touchmove', (e) => evaluateTouches(e.touches), { passive: true });
        canvas.addEventListener('touchend', (e) => evaluateTouches(e.touches), { passive: true });
        canvas.addEventListener('touchcancel', (e) => evaluateTouches(e.touches), { passive: true });

        // Mouse fallback for desktop testing while developing.
        let mouseDown = false;
        canvas.addEventListener('mousedown', (e) => {
            mouseDown = true;
            evaluateMouse(e);
        });
        window.addEventListener('mousemove', (e) => {
            if (mouseDown) evaluateMouse(e);
        });
        window.addEventListener('mouseup', () => {
            mouseDown = false;
            self.accelerate = false;
            self.brake = false;
        });
        function evaluateMouse(e) {
            const rect = canvas.getBoundingClientRect();
            const localX = e.clientX - rect.left;
            self.brake = localX < rect.width / 2;
            self.accelerate = !self.brake;
        }
    }
};
